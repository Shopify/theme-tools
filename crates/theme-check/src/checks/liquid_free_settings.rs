use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::{visit_json, JsonNode, JsonRef, Lit};
use liquid_ast::{NodeKind, NodeRef, Span};

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
        let offset = tag.start_tag.end;
        let file = cx.file;
        let Ok(json_file) = &file.schema(tag).ast else {
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
                let span = literal.span;
                cx.report(
                    "Settings values cannot contain liquid logic.",
                    Span::new(offset + span.start, offset + span.end),
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
