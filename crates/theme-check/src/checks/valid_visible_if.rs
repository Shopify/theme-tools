use super::schema_utils::{array, get, has, report_warning};
use crate::context::{
    CheckDef, CheckError, CheckResult, Context, Create, JsonCheck, LiquidCheck, Severity,
};
use crate::js;
use crate::json::{parse_json, JsonKind, JsonNode, JsonRef, Lit, PathSeg::*};
use crate::schema::SchemaKind;
use crate::visible_if::{with_variable_lookups_in_expression, VisibleIfLookups, OFFSET_ADJUST};
use liquid_ast::{LiquidRawTag, Markup, Node, NodeKind, NodeRef, VariableLookup};
use serde_json::Value;
use std::collections::HashSet;

pub static VALID_VISIBLE_IF: CheckDef = CheckDef {
    code: "ValidVisibleIf",
    name: "Validate visible_if expressions",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create_liquid),
};

/// `ValidVisibleIfSettingsSchema`: the same check (and code) for `config/settings_schema.json`.
pub static VALID_VISIBLE_IF_SETTINGS_SCHEMA: CheckDef = CheckDef {
    create: Create::Json(create_json),
    ..VALID_VISIBLE_IF
};

#[derive(Default)]
struct Check<'a> {
    assigned_variables: HashSet<&'a str>,
    schema_node: Option<&'a LiquidRawTag<'a>>,
}

fn create_liquid<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], _cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidTag(tag) if tag.name == "assign" => {
                if let Markup::Node(m) = &tag.markup {
                    if let Node::AssignMarkup(a) = m.as_ref() {
                        self.assigned_variables.insert(&a.name);
                    }
                }
            }
            NodeRef::LiquidRawTag(tag) if tag.name == "schema" && tag.body.kind == "json" => {
                self.schema_node = Some(tag)
            }
            _ => {}
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(schema_node) = self.schema_node else {
            return Ok(());
        };
        let Some(schema) = cx.get_schema() else {
            return Ok(());
        };
        let Some(valid_schema) = schema.valid_value().filter(|v| js::truthy(v)) else {
            return Ok(());
        };
        // `!validSchema.settings?.some((setting) => 'visible_if' in setting)`
        let settings = get(valid_schema, "settings")?;
        let mut any_visible_if = false;
        if settings.is_some_and(|s| !s.is_null()) {
            for setting in array(settings, "settings.some")? {
                if has(setting, "visible_if")? {
                    any_visible_if = true;
                    break;
                }
            }
        }
        if !any_visible_if {
            return Ok(());
        }
        let Some(ast) = schema.ast() else {
            return Ok(());
        };
        let settings = array(settings, "settings")?;

        let offset = schema_node.block_start_position.end;
        let global_settings = get_global_settings(cx);
        let mut current_file_settings = HashSet::new();
        for setting in settings {
            current_file_settings.insert(js::opt_to_string(get(setting, "id")?));
        }
        let vars = Vars {
            assigned: &self.assigned_variables,
            global: &global_settings,
            file: Some((schema.kind, &current_file_settings)),
        };
        let is_section = schema.kind == SchemaKind::Section;
        let is_block = schema.kind == SchemaKind::Block;

        for (i, setting) in settings.iter().enumerate() {
            if !has(setting, "visible_if")? {
                continue;
            }
            let Some(Value::String(visible_if)) = get(setting, "visible_if")? else {
                continue;
            };
            let visible_if_node = ast.at_path(&[Key("settings"), Index(i), Key("visible_if")]);

            with_variable_lookups_in_expression(visible_if, |result| -> CheckResult {
                let lookups = match result {
                    VisibleIfLookups::Null => return Ok(()),
                    VisibleIfLookups::Warning(warning) => {
                        return report_warning(cx, warning, offset, visible_if_node)
                    }
                    VisibleIfLookups::Lookups(lookups) => lookups,
                };
                let node_start = visible_if_node.map(|n| n.loc().start);
                for lookup in lookups {
                    let message = match lookup.name.as_deref() {
                        // We don't know which section a block goes in, so section settings can't be checked.
                        Some("section") if is_block => None,
                        Some("section") if !is_section => Some(
                            "Invalid visible_if: can't refer to \"section\" when not in a section or block file.".to_string(),
                        ),
                        Some("block") if !is_block => {
                            Some("Invalid visible_if: can't refer to \"block\" when not in a block file.".to_string())
                        }
                        _ => validate_lookup(lookup, &vars)?,
                    };
                    if let Some(message) = message {
                        // getLocStart(undefined) throws
                        let start = node_start.ok_or_else(|| {
                            CheckError::new("Cannot read properties of undefined (reading 'loc')")
                        })?;
                        let (s, e) = lookup_range(offset + start, lookup);
                        cx.report(message, s, e);
                    }
                }
                Ok(())
            })?;
        }
        Ok(())
    }
}

struct JsonVisibleIf {
    global_settings: Option<HashSet<String>>,
}

fn create_json<'a>(cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    if cx.to_relative_path(cx.uri()) != "config/settings_schema.json" {
        return None;
    }
    Some(Box::new(JsonVisibleIf {
        global_settings: None,
    }))
}

impl<'a> JsonCheck<'a> for JsonVisibleIf {
    fn node_mask(&self) -> u64 {
        JsonKind::Property.bit()
    }

    fn node(&mut self, node: JsonRef<'a>, _: &[JsonRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let JsonRef::Property(p) = node else {
            return Ok(());
        };
        if p.key.value != "visible_if" {
            return Ok(());
        }
        let JsonNode::Literal(lit) = &p.value else {
            return Ok(());
        };
        let Lit::Str(expression) = &lit.value else {
            return Ok(());
        };
        let offset = lit.loc.start;

        with_variable_lookups_in_expression(expression, |result| -> CheckResult {
            let lookups = match result {
                VisibleIfLookups::Null => return Ok(()),
                VisibleIfLookups::Warning(warning) => {
                    cx.report(warning, lit.loc.start, lit.loc.end);
                    return Ok(());
                }
                VisibleIfLookups::Lookups(lookups) => lookups,
            };
            let global = self
                .global_settings
                .get_or_insert_with(|| get_global_settings(cx));
            let vars = Vars {
                assigned: &HashSet::new(),
                global,
                file: None,
            };
            for lookup in lookups {
                let message = match lookup.name.as_deref() {
                    // settings_schema.json can't reference `section` or `block`.
                    Some("section") => {
                        Some("Invalid visible_if: can't refer to \"section\" when not in a section file.".to_string())
                    }
                    Some("block") => Some("Invalid visible_if: can't refer to \"block\" when not in a block file.".to_string()),
                    _ => validate_lookup(lookup, &vars)?,
                };
                if let Some(message) = message {
                    let (s, e) = lookup_range(offset, lookup);
                    cx.report(message, s, e);
                }
            }
            Ok(())
        })
    }
}

/// `offset + lookup.position + offsetAdjust + 1`: the `+ 1` skips the opening quote.
///
/// ponytail: TS does this in UTF-16 units and we do it in bytes; they only disagree where TS is
/// already off (escapes in the JSON string, or text before the `{{`) and the text is non-ASCII.
fn lookup_range(offset: usize, lookup: &VariableLookup) -> (usize, usize) {
    let at = |p: usize| (offset as isize + p as isize + OFFSET_ADJUST + 1) as usize;
    (at(lookup.position.start), at(lookup.position.end))
}

/// The `Vars` tree: `{ ...assignedVariables, settings: {...global}, section|block: { settings: {...current} } }`.
struct Vars<'v> {
    assigned: &'v HashSet<&'v str>,
    global: &'v HashSet<String>,
    /// The schema kind and its settings' ids (Liquid files only).
    file: Option<(SchemaKind, &'v HashSet<String>)>,
}

#[derive(Clone, Copy)]
enum Scope {
    Top,
    Global,
    /// `{ settings: currentFileSettings }`
    File,
    Current,
    /// An `Object.prototype` member.
    Proto,
}

enum Next {
    Missing,
    Variable,
    Namespace(Scope),
}

/// ponytail: `scope[segment]` also finds `Object.prototype` members in JS. We treat them as empty
/// namespaces, which matches the common cases (`settings.constructor`) but not deeper ones
/// (`settings.constructor.name`).
const OBJECT_PROTOTYPE: &[&str] = &[
    "__proto__",
    "constructor",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "toString",
    "valueOf",
    "__defineGetter__",
    "__defineSetter__",
    "__lookupGetter__",
    "__lookupSetter__",
];

impl Vars<'_> {
    fn step(&self, scope: Scope, segment: &str) -> Next {
        let found = match scope {
            Scope::Top => match (segment, self.file) {
                ("settings", _) => return Next::Namespace(Scope::Global),
                ("section", Some((SchemaKind::Section, _)))
                | ("block", Some((SchemaKind::Block, _))) => return Next::Namespace(Scope::File),
                _ => self.assigned.contains(segment),
            },
            Scope::Global => self.global.contains(segment),
            Scope::File if segment == "settings" => return Next::Namespace(Scope::Current),
            Scope::File | Scope::Proto => false,
            Scope::Current => self.file.is_some_and(|(_, c)| c.contains(segment)),
        };
        match () {
            _ if found => Next::Variable,
            _ if !matches!(scope, Scope::Proto) && OBJECT_PROTOTYPE.contains(&segment) => {
                Next::Namespace(Scope::Proto)
            }
            _ => Next::Missing,
        }
    }
}

/// `validateLookup(lookup, vars)`
fn validate_lookup(lookup: &VariableLookup, vars: &Vars) -> Result<Option<String>, CheckError> {
    // `[lookup.name, ...lookups]`: a null name is the key "null" and joins as "".
    let mut segments = vec![lookup.name.as_deref()];
    for l in &lookup.lookups {
        let Node::String(s) = l else {
            return Err(CheckError::new(
                "Error: Expected lookups to be String nodes",
            ));
        };
        segments.push(Some(&s.value));
    }
    let popped = |n: usize| {
        segments[..n]
            .iter()
            .map(|s| s.unwrap_or(""))
            .collect::<Vec<_>>()
            .join(".")
    };
    let mut scope = Scope::Top;
    for (i, segment) in segments.iter().enumerate() {
        match vars.step(scope, segment.unwrap_or("null")) {
            Next::Missing => return Ok(Some(format!("Invalid variable: \"{}\" was not found.", popped(i + 1)))),
            Next::Variable if i + 1 < segments.len() => {
                return Ok(Some(format!(
                    "Invalid variable: \"{}\" refers to a variable, but is being used here as a namespace.",
                    popped(i + 1)
                )))
            }
            Next::Variable => return Ok(None),
            Next::Namespace(next) => scope = next,
        }
    }
    Ok(Some(format!(
        "Invalid variable: \"{}\" refers to a namespace, but is being used here as a variable.",
        popped(segments.len())
    )))
}

/// `getGlobalSettings(context)`: setting ids from `config/settings_schema.json`, or what was
/// collected before a malformed group threw.
fn get_global_settings(cx: &Context) -> HashSet<String> {
    let mut global_settings = HashSet::new();
    let Ok(source) = cx
        .deps
        .fs
        .read_file(&cx.to_uri("config/settings_schema.json"))
    else {
        return global_settings;
    };
    let Some(Value::Array(groups)) = parse_json(&source) else {
        return global_settings;
    };
    for group in &groups {
        match js::has(group, "settings") {
            Err(_) => break,
            Ok(false) => continue,
            Ok(true) => {}
        }
        let Some(Value::Array(settings)) = group.get("settings") else {
            continue;
        };
        let Some(ids) = settings
            .iter()
            .map(|s| js::get(s, "id"))
            .collect::<Result<Vec<_>, _>>()
            .ok()
        else {
            break;
        };
        global_settings.extend(
            ids.into_iter()
                .flatten()
                .filter(|id| js::truthy(id))
                .map(js::to_string),
        );
    }
    global_settings
}
