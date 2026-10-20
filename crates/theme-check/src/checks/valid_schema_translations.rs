use super::schema_utils::deep_get;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::json::{JsonNode, Lit, LiteralNode};
use liquid_ast::{NodeKind, NodeRef};

pub static VALID_SCHEMA_TRANSLATIONS: CheckDef = CheckDef {
    code: "ValidSchemaTranslations",
    name: "Reports missing translation keys in schema",
    aliases: &[],
    severity: Severity::Error,
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
        let Some(ast) = cx.get_schema().and_then(|s| s.ast()) else {
            return Ok(());
        };

        let mut translation_nodes = Vec::new();
        find_translation_keys(ast, &mut translation_nodes);
        for (value, literal) in translation_nodes {
            let key: Vec<&str> = value["t:".len()..].split('.').collect();
            if deep_get(cx.default_schema_translations(), &key).is_none() {
                let message = format!(
                    "'{value}' does not have a matching entry in 'locales/{}.default.schema.json'",
                    cx.default_locale()
                );
                cx.report(
                    message,
                    offset + literal.loc.start,
                    offset + literal.loc.end,
                );
            }
        }
        Ok(())
    }
}

/// String literals starting with `t:`, in document order.
fn find_translation_keys<'n, 'a>(
    node: &'n JsonNode<'a>,
    out: &mut Vec<(&'n str, &'n LiteralNode<'a>)>,
) {
    match node {
        JsonNode::Literal(l) => {
            if let Lit::Str(s) = &l.value {
                if s.starts_with("t:") {
                    out.push((s, l));
                }
            }
        }
        JsonNode::Object(o) => o
            .children
            .iter()
            .for_each(|p| find_translation_keys(&p.value, out)),
        JsonNode::Array(a) => a
            .children
            .iter()
            .for_each(|c| find_translation_keys(c, out)),
    }
}
