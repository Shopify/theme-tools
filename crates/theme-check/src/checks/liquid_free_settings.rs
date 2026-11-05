use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::{to_json_node, visit_json, JsonNode, JsonRef, Lit};
use liquid_ast::{NodeKind, NodeRef};

pub static LIQUID_FREE_SETTINGS: CheckDef = CheckDef {
    code: "LiquidFreeSettings",
    name: "Check for liquid free settings values",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidRawTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidRawTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "schema" || tag.body.kind != "json" {
            return Ok(());
        }
        let offset = tag.block_start_position.end;
        let Some(json_string) = cx.source().get(offset..tag.block_end_position.start) else {
            return Ok(());
        };
        let Ok(json_file) = to_json_node(json_string) else {
            return Ok(());
        };

        visit_json(json_file.to_ref(), |node, ancestors, is_exit| {
            let JsonRef::Property(property) = node else {
                return;
            };
            if is_exit || !is_in_array_with_parent_key(ancestors, "settings") {
                return;
            }
            let JsonNode::Literal(literal) = &property.value else {
                return;
            };
            if is_liquid_type(ancestors) {
                return;
            }
            let Lit::Str(value) = &literal.value else {
                return;
            };
            if property.key.value != "visible_if" && value.contains("{%") && value.contains("%}") {
                let loc = literal.loc;
                cx.report(
                    "Settings values cannot contain liquid logic.",
                    offset + loc.start,
                    offset + loc.end,
                );
            }
        });
        Ok(())
    }
}

/// The parent is an object with `"type": "liquid"`.
fn is_liquid_type(ancestors: &[JsonRef]) -> bool {
    let Some(JsonRef::Object(parent)) = ancestors.last() else {
        return false;
    };
    parent.children.iter().any(|p| {
        p.key.value == "type"
            && matches!(&p.value, JsonNode::Literal(l) if l.value.as_str() == Some("liquid"))
    })
}

fn is_in_array_with_parent_key(ancestors: &[JsonRef], parent_key: &str) -> bool {
    ancestors.windows(2).any(|w| {
        matches!(w[1], JsonRef::Array(_) | JsonRef::Object(_))
            && matches!(w[0], JsonRef::Property(p) if p.key.value == parent_key)
    })
}
