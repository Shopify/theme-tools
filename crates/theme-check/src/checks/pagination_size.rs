use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::js;
use crate::json::{js_number_to_string, parse_json};
use liquid_ast::{Markup, Node, NodeKind, NodeRef, VariableLookup};
use serde_json::Value;

pub static PAGINATION_SIZE: CheckDef = CheckDef {
    code: "PaginationSize",
    name: "Ensure paginate tags are used with performant sizes",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[("minSize", "1"), ("maxSize", "250")],
    create: Create::Liquid(create),
};

struct Check<'a> {
    min_size: f64,
    max_size: f64,
    schema_settings: Vec<Value>,
    page_size_lookups: Vec<&'a VariableLookup<'a>>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check {
        min_size: cx.setting_f64("minSize").unwrap_or(1.0),
        max_size: cx.setting_f64("maxSize").unwrap_or(250.0),
        schema_settings: Vec::new(),
        page_size_lookups: Vec::new(),
    }))
}

impl Check<'_> {
    /// `checkPageSize(node, value, message)`: `value` is compared like JS `min <= value <= max`.
    fn in_range(&self, value: f64) -> bool {
        self.min_size <= value && value <= self.max_size
    }

    fn default_message(&self) -> String {
        format!(
            "Pagination size must be a positive integer between {} and {}.",
            js_number_to_string(self.min_size),
            js_number_to_string(self.max_size)
        )
    }
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidTag(tag) if tag.name == "paginate" => {
                let Markup::Node(m) = &tag.markup else {
                    return Ok(());
                };
                let Node::PaginateMarkup(m) = m.as_ref() else {
                    return Ok(());
                };
                match m.page_size.as_ref() {
                    Node::VariableLookup(v) => self.page_size_lookups.push(v),
                    Node::Number(n) => {
                        if !self.in_range(js::string_to_number(&n.value)) {
                            cx.report(self.default_message(), n.position.start, n.position.end);
                        }
                    }
                    _ => {}
                }
            }
            NodeRef::LiquidRawTag(tag) if tag.name == "schema" => {
                // `schema.settings` throws on `undefined` (empty body) and `null`.
                match parse_json(&tag.body.value) {
                    None => {
                        return Err(CheckError::new(
                            "Cannot read properties of undefined (reading 'settings')",
                        ))
                    }
                    Some(Value::Null) => {
                        return Err(CheckError::new(
                            "Cannot read properties of null (reading 'settings')",
                        ))
                    }
                    Some(Value::Object(mut schema)) => {
                        if let Some(Value::Array(settings)) = schema.remove("settings") {
                            self.schema_settings = settings;
                        }
                    }
                    Some(_) => {}
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        for lookup in &self.page_size_lookups {
            let Some(Node::String(last)) = lookup.lookups.last() else {
                continue;
            };
            let mut setting = None;
            for s in &self.schema_settings {
                // `settings.find((setting) => setting.id === settingId)`
                if js::get(s, "id")
                    .map_err(CheckError)?
                    .and_then(Value::as_str)
                    == Some(&last.value)
                {
                    setting = Some(s);
                    break;
                }
            }
            let Some(setting) = setting else { continue };
            let p = lookup.position;
            let Some(default) = setting.get("default") else {
                cx.report(
                    "Default pagination size should be defined in the section settings.",
                    p.start,
                    p.end,
                );
                continue;
            };
            if !self.in_range(js::to_number(default)) {
                cx.report(
                    format!(
                        "This setting's default value should be between {} and {} but is currently {}.",
                        js_number_to_string(self.min_size),
                        js_number_to_string(self.max_size),
                        js::to_string(default)
                    ),
                    p.start,
                    p.end,
                );
            }
        }
        Ok(())
    }
}
