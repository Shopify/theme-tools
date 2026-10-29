use super::args_utils::is_supported_named_param_type;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use crate::liquid_doc::parse_string_literals;
use liquid_ast::{NodeKind, NodeRef};

pub static VALID_DOC_PARAM_TYPES: CheckDef = CheckDef {
    code: "ValidDocParamTypes",
    name: "Valid doc parameter types",
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

/// `isSupportedParamType(type)`
fn is_supported_param_type(cx: &Context, ty: &str) -> bool {
    // usesStringLiteralSyntax
    if ty.contains(['\'', '"', '|']) {
        return parse_string_literals(ty).is_some();
    }
    // Named types come from the docset, so they can only be checked with one.
    cx.docset()
        .map_or(true, |d| is_supported_named_param_type(d, ty))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidDocParamNode.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidDocParamNode(node) = node else {
            return Ok(());
        };
        let Some(param_type) = &node.param_type else {
            return Ok(());
        };
        if !is_supported_param_type(cx, &param_type.value) {
            let message = format!(
                "The parameter type '{}' is not supported.",
                param_type.value
            );
            // Offset to include the curly brackets around the param type.
            let (start, end) = param_type_removal_range(cx.source(), param_type.position);
            let suggest = vec![Suggestion::new(
                "Remove invalid parameter type",
                Fix::replace(start, end, " "),
            )];
            cx.report_with(
                message,
                param_type.position.start - 1,
                param_type.position.end + 1,
                None,
                Some(suggest),
            );
        }
        Ok(())
    }
}

/// `paramTypeRemovalRange(source, paramType)`: the type, its braces, and the spaces and tabs
/// around them.
fn param_type_removal_range(source: &str, p: liquid_ast::Position) -> (usize, usize) {
    let b = source.as_bytes();
    let space_or_tab = |i: usize| matches!(b.get(i), Some(b' ' | b'\t'));
    let (mut start, mut end) = (p.start - 1, p.end + 1);
    while start > 0 && space_or_tab(start - 1) {
        start -= 1;
    }
    while space_or_tab(end) {
        end += 1;
    }
    (start, end)
}
