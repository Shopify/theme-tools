use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, Severity};
use crate::json::{JsonNode, Lit, PropertyNode};
use std::collections::HashMap;

pub static UNIQUE_SETTING_ID: CheckDef = CheckDef {
    code: "UniqueSettingId",
    name: "Prevent duplicate Ids in setting_schema",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Json(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> JsonCheck<'a> for Check {
    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let Some(JsonNode::Array(root)) = cx.file.json_ast() else {
            return Ok(());
        };
        // A JS Map: ids in first-seen order, with every node that uses them.
        let mut ids: Vec<(&str, Vec<&PropertyNode>)> = Vec::new();
        let mut index: HashMap<&str, usize> = HashMap::new();
        for child in &root.children {
            let JsonNode::Object(group) = child else {
                continue;
            };
            let Some(JsonNode::Array(settings)) = group.get("settings").map(|p| &p.value) else {
                continue;
            };
            for setting in &settings.children {
                let JsonNode::Object(setting) = setting else {
                    continue;
                };
                let Some(id_node) = setting.get("id") else {
                    continue;
                };
                let JsonNode::Literal(lit) = &id_node.value else {
                    continue;
                };
                let Lit::Str(id) = &lit.value else { continue };
                let i = *index.entry(id).or_insert_with(|| {
                    ids.push((id, Vec::new()));
                    ids.len() - 1
                });
                ids[i].1.push(id_node);
            }
        }
        for (id, nodes) in &ids {
            if let [_, .., last] = nodes[..] {
                cx.report(
                    format!("Duplicate setting id found: \"{id}\""),
                    last.loc.start,
                    last.loc.end,
                );
            }
        }
        Ok(())
    }
}
