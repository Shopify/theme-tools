use super::schema_utils::{array, get, get_blocks, has, node_at, strict_eq, BlockWithPath};
use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, LiquidCheck, Severity};
use crate::js;
use crate::json::{js_number_to_string, JsonKind, JsonNode, JsonRef, Lit, ObjectNode, PathSeg};
use crate::schema::SchemaKind;
use liquid_ast::{NodeKind, NodeRef, Span};
use serde_json::Value;

pub static VALID_SELECT_DEFAULT: CheckDef = CheckDef {
    code: "ValidSelectDefault",
    name: "Validate default values and preset values for select/radio settings",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create_liquid),
};

/// `ValidSelectDefaultSettingsSchema`: the same check (and code) for `config/settings_schema.json`.
pub static VALID_SELECT_DEFAULT_SETTINGS_SCHEMA: CheckDef = CheckDef {
    create: Create::Json(create_json),
    ..VALID_SELECT_DEFAULT
};

struct Check;

fn create_liquid<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::LiquidRawTag]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "schema" || tag.body.kind != "json" {
            return Ok(());
        }
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        let Some(ast) = schema.ast() else {
            return Ok(());
        };

        let mut report = Report {
            cx,
            offset: tag.start_tag.end,
        };
        let settings = ast.at_path(&[PathSeg::Key("settings")]);
        let blocks = get_blocks(valid_schema)?;
        let local = &blocks.root_level_local_blocks;

        // The defaults of the file's settings, and of its local blocks' settings.
        check_defaults(settings, &mut report);
        for block in local {
            check_defaults(node_at(ast, &settings_path(&block.path)), &mut report);
        }

        // The values presets give the file's settings.
        if let Some(Value::Array(presets)) = get(valid_schema, "presets")? {
            for i in 0..presets.len() {
                let values = ast.at_path(&[
                    PathSeg::Key("presets"),
                    PathSeg::Index(i),
                    PathSeg::Key("settings"),
                ]);
                check_values(values, settings, &mut report);
            }
        }

        // The values presets and section defaults give their blocks' settings.
        for depth in &blocks.preset_level_blocks {
            for block in depth {
                let block_settings = referenced_block_settings(report.cx, ast, local, block.ty());
                check_values(
                    node_at(ast, &settings_path(&block.path)),
                    block_settings,
                    &mut report,
                );
            }
        }

        if schema.kind == SchemaKind::Section && has(valid_schema, "default")? {
            if let Some(default) = get(valid_schema, "default")?.filter(|d| js::truthy(d)) {
                let values = ast.at_path(&[PathSeg::Key("default"), PathSeg::Key("settings")]);
                check_values(values, settings, &mut report);

                let default_blocks = match get(default, "blocks")?.filter(|b| !b.is_null()) {
                    Some(b) => array(Some(b), "map")?,
                    None => &[],
                };
                for (i, block) in default_blocks.iter().enumerate() {
                    let ty = get(block, "type")?;
                    let block_settings = referenced_block_settings(report.cx, ast, local, ty);
                    let path = [
                        "default".to_string(),
                        "blocks".into(),
                        i.to_string(),
                        "type".into(),
                    ];
                    check_values(
                        node_at(ast, &settings_path(&path)),
                        block_settings,
                        &mut report,
                    );
                }
            }
        }
        Ok(())
    }
}

struct JsonSelectDefault;

fn create_json<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    (cx.to_relative_path(cx.uri()) == "config/settings_schema.json")
        .then(|| Box::new(JsonSelectDefault) as Box<dyn JsonCheck<'a> + 'a>)
}

impl<'a> JsonCheck<'a> for JsonSelectDefault {
    fn kinds(&self) -> &'static [JsonKind] {
        &[JsonKind::Property]
    }

    fn enter(&mut self, node: JsonRef<'a>, _: &[JsonRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let JsonRef::Property(p) = node else {
            return Ok(());
        };
        if p.key.value == "settings" {
            check_defaults(Some(&p.value), &mut Report { cx, offset: 0 });
        }
        Ok(())
    }
}

/// Reports offenses at JSON nodes, which start at `offset` in the file.
struct Report<'r, 'a> {
    cx: &'r mut Context<'a>,
    offset: usize,
}

impl Report<'_, '_> {
    fn at(&mut self, message: String, span: Span) {
        let (start, end) = (self.offset + span.start, self.offset + span.end);
        self.cx.report(message, Span::new(start, end));
    }
}

/// Reports each select/radio setting in `settings` whose default isn't one of its options.
fn check_defaults(settings: Option<&JsonNode>, report: &mut Report) {
    let Some(JsonNode::Array(settings)) = settings else {
        return;
    };
    for setting in &settings.children {
        let JsonNode::Object(setting) = setting else {
            continue;
        };
        let Some(Lit::Str(id)) = literal(setting, "id") else {
            continue;
        };
        let Some(options) = choice_options(setting) else {
            continue;
        };
        let Some(JsonNode::Literal(default)) = setting.get("default").map(|p| &p.value) else {
            continue;
        };
        if is_scalar(&default.value) && !options.contains(&default.value.to_js_string()) {
            let message = format!(
                "Default value {} for setting \"{id}\" is not one of the valid options: {}.",
                stringify(&default.value),
                list(&options)
            );
            report.at(message, default.span);
        }
    }
}

/// Reports each value in `values`, an object of setting values by id, that isn't one of the
/// options of the select/radio setting it sets in `settings`.
fn check_values(values: Option<&JsonNode>, settings: Option<&JsonNode>, report: &mut Report) {
    let (Some(JsonNode::Object(values)), Some(JsonNode::Array(settings))) = (values, settings)
    else {
        return;
    };
    for property in &values.children {
        let id = &property.key.value;
        let setting = settings.children.iter().find_map(|s| match s {
            JsonNode::Object(s) if literal(s, "id").and_then(Lit::as_str) == Some(id) => Some(s),
            _ => None,
        });
        let Some(options) = setting.and_then(choice_options) else {
            continue;
        };
        let JsonNode::Literal(value) = &property.value else {
            continue;
        };
        if is_scalar(&value.value) && !options.contains(&value.value.to_js_string()) {
            let message = format!(
                "Value {} for setting \"{id}\" is not one of the valid options: {}.",
                stringify(&value.value),
                list(&options)
            );
            report.at(message, value.span);
        }
    }
}

/// The settings of the block a preset or section default uses, from its schema.
fn referenced_block_settings<'n, 'a>(
    cx: &Context<'a>,
    ast: &'n JsonNode<'a>,
    local_blocks: &[BlockWithPath],
    ty: Option<&Value>,
) -> Option<&'n JsonNode<'a>>
where
    'a: 'n,
{
    // A section with local blocks can only use those.
    if !local_blocks.is_empty() {
        let local_block = local_blocks.iter().find(|b| strict_eq(b.ty(), ty))?;
        return node_at(ast, &settings_path(&local_block.path));
    }
    let Some(Value::String(ty)) = ty else {
        return None;
    };
    let block_schema = cx.get_block_schema(ty)?;
    block_schema.valid_value().filter(|v| js::truthy(v))?;
    block_schema.ast()?.at_path(&[PathSeg::Key("settings")])
}

/// The option values of a select or radio setting, or `None` for any other setting.
fn choice_options(setting: &ObjectNode) -> Option<Vec<String>> {
    if !matches!(
        literal(setting, "type").and_then(Lit::as_str),
        Some("select" | "radio")
    ) {
        return None;
    }
    let JsonNode::Array(options) = &setting.get("options")?.value else {
        return None;
    };
    let values = options.children.iter().filter_map(|option| match option {
        JsonNode::Object(option) => literal(option, "value").filter(|v| is_scalar(v)),
        _ => None,
    });
    Some(values.map(Lit::to_js_string).collect())
}

/// The value of `object[key]` when it's a literal.
fn literal<'n, 'a>(object: &'n ObjectNode<'a>, key: &str) -> Option<&'n Lit<'a>> {
    match &object.get(key)?.value {
        JsonNode::Literal(l) => Some(&l.value),
        _ => None,
    }
}

fn is_scalar(value: &Lit) -> bool {
    !matches!(value, Lit::Null)
}

/// `JSON.stringify(value)` of a scalar.
fn stringify(value: &Lit) -> String {
    match value {
        Lit::Str(s) => serde_json::to_string(s).unwrap_or_default(),
        Lit::Num(n) => js_number_to_string(*n),
        Lit::Bool(b) => b.to_string(),
        Lit::Null => "null".into(),
    }
}

fn list(options: &[String]) -> String {
    options
        .iter()
        .map(|o| format!("\"{o}\""))
        .collect::<Vec<_>>()
        .join(", ")
}

/// The path of a block's `settings`, from the path of its `type`.
fn settings_path(type_path: &[String]) -> Vec<String> {
    let mut path = type_path[..type_path.len().saturating_sub(1)].to_vec();
    path.push("settings".into());
    path
}
