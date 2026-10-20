use super::args_utils::{
    check_argument_type, generate_type_mismatch_suggestions, get_argument_type_mismatch_message,
    infer_argument_type, is_type_compatible, ArgumentTypeCheck,
};
use super::block_tag_syntax::valid_block_markup;
use crate::block_parameters::{liquid_doc_type, BlockParameters, BLOCK_CONTENT_PARAMETER};
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::liquid_doc::parse_string_literals;
use crate::path;
use crate::schema::is_block;
use liquid_ast::{Node, NodeKind, NodeRef};
use std::borrow::Cow;

pub static VALID_BLOCK_ARGUMENT_TYPES: CheckDef = CheckDef {
    code: "ValidBlockArgumentTypes",
    name: "Valid Block Argument Types",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check<'a> {
    current_block_name: Option<String>,
    current_parameters: Option<Option<&'a BlockParameters>>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let current_block_name = is_block(cx.uri())
        .then(|| path::basename(cx.uri(), Some(".liquid")))
        .filter(|n| !n.is_empty());
    Some(Box::new(Check {
        current_block_name,
        current_parameters: None,
    }))
}

/// `literalType(value)`: `None` for lookups and empty or partly unknown arrays.
fn literal_type(value: &Node) -> Option<Cow<'static, str>> {
    match value {
        Node::VariableLookup(_) => None,
        Node::BlockArrayLiteral(a) => {
            let mut first: Option<Cow<'static, str>> = None;
            let mut mixed = false;
            for e in &a.elements {
                let t = literal_type(e)?;
                match &first {
                    None => first = Some(t),
                    Some(f) => mixed |= *f != t,
                }
            }
            let first = first?;
            Some(if mixed {
                "mixed[]".into()
            } else {
                format!("{first}[]").into()
            })
        }
        _ => Some(infer_argument_type(value).into()),
    }
}

/// `isCallTypeCompatible(expectedType, actualType)`
fn is_call_type_compatible(expected: &str, actual: &str) -> bool {
    if expected == "object" {
        return true;
    }
    if actual == "object" || actual.ends_with("[]") {
        return expected == actual;
    }
    is_type_compatible(expected, actual)
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit() | NodeKind::LiquidDocParamNode.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        match node {
            NodeRef::LiquidTag(tag) => {
                let Some(markup) = valid_block_markup(tag, cx.source()) else {
                    return Ok(());
                };
                let Some(parameters) = cx.get_block_parameters(&markup.name.value) else {
                    return Ok(());
                };
                for arg in &markup.args {
                    let expected = parameters
                        .get(&arg.name)
                        .and_then(|p| p.type_.as_deref())
                        .filter(|t| !t.is_empty());
                    let p = arg.value.position();
                    if let Some(expected) = expected.filter(|t| parse_string_literals(t).is_some())
                    {
                        // reportStringLiteralMismatch
                        if check_argument_type(expected, &arg.value)
                            == ArgumentTypeCheck::Incompatible
                        {
                            let message = get_argument_type_mismatch_message(
                                &arg.name,
                                expected,
                                &arg.value,
                                cx.source(),
                            );
                            let suggest =
                                generate_type_mismatch_suggestions(expected, p.start, p.end);
                            cx.report_with(message, p.start, p.end, None, Some(suggest));
                        }
                        continue;
                    }
                    let (Some(expected), Some(actual)) = (expected, literal_type(&arg.value))
                    else {
                        continue;
                    };
                    if !is_call_type_compatible(expected, &actual) {
                        let message = format!(
                            "Type mismatch for argument '{}': expected {expected}, got {actual}",
                            arg.name
                        );
                        cx.report(message, p.start, p.end);
                    }
                }
            }
            NodeRef::LiquidDocParamNode(node) => {
                let Some(name) = &self.current_block_name else {
                    return Ok(());
                };
                let parameters = *self
                    .current_parameters
                    .get_or_insert_with(|| cx.get_block_parameters(name));
                let Some(parameter) = parameters.and_then(|p| p.get(&node.param_name.value)) else {
                    return Ok(());
                };

                // reportLiquidDocTypeMismatch
                let Some(param_type) = &node.param_type else {
                    return Ok(());
                };
                let Some(declared) = liquid_doc_type(Some(&param_type.value)) else {
                    return Ok(());
                };
                let is_content = parameter.name == BLOCK_CONTENT_PARAMETER;
                // declarationType
                let authoritative = if parameter.schema_setting.is_none() && !is_content {
                    None
                } else {
                    parameter.type_.as_deref()
                };
                let Some(authoritative) = authoritative.filter(|t| !t.is_empty()) else {
                    return Ok(());
                };
                if declared == "object" || declared == authoritative {
                    return Ok(());
                }
                let source = if is_content {
                    "built-in parameter"
                } else {
                    "schema setting"
                };
                let message = format!(
                    "The {source} '{}' has Liquid type '{authoritative}', but LiquidDoc declares '{declared}'. The {source} type is authoritative.",
                    parameter.name
                );
                cx.report(
                    message,
                    param_type.position.start - 1,
                    param_type.position.end + 1,
                );
            }
            _ => {}
        }
        Ok(())
    }
}
