use super::schema_utils::{content_for_block, string_arg};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Node, NodeKind, NodeRef};
use std::collections::HashSet;

pub static UNIQUE_STATIC_BLOCK_ID: CheckDef = CheckDef {
    code: "UniqueStaticBlockId",
    name: "Prevent use of duplicated ids for blocks rendered statically",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// `REQUIRED_CONTENT_FOR_ARGUMENTS` and `RESERVED_CONTENT_FOR_ARGUMENTS`.
const FRAMEWORK_ARGS: &[&str] = &[
    "id",
    "type",
    "attributes",
    "block",
    "blocks",
    "class",
    "context",
    "inherit",
    "resource",
    "resources",
    "schema",
    "section",
    "sections",
    "settings",
    "snippet",
    "snippets",
    "src",
    "style",
    "styles",
    "template",
    "templates",
];

#[derive(Default)]
struct Check {
    used_composite_keys: HashSet<String>,
}

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        let Some(markup) = content_for_block(tag) else {
            return Ok(());
        };
        // A missing or non-string id is VariableContentForArguments' job.
        let Some(id_node) = string_arg(markup, "id") else {
            return Ok(());
        };

        let mut arg_parts = Vec::new();
        for arg in markup
            .args
            .iter()
            .filter(|a| !FRAMEWORK_ARGS.contains(&a.name.as_ref()))
        {
            let Node::String(value) = arg.value.as_ref() else {
                return Ok(());
            };
            arg_parts.push(format!("{}={}", arg.name, value.value));
        }
        // JS sorts by UTF-16 code unit.
        arg_parts.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        let composite_key = format!("{}::{}", id_node.value, arg_parts.join(","));

        if self.used_composite_keys.contains(&composite_key) {
            cx.report_with(
                format!(
                    "The id '{}' is already being used by another static block",
                    id_node.value
                ),
                id_node.position.start,
                id_node.position.end,
                None,
                Some(Vec::new()),
            );
        } else {
            self.used_composite_keys.insert(composite_key);
        }
        Ok(())
    }
}
