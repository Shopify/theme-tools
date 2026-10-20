use super::args_utils::{
    CLOSEST_ARGUMENT, REQUIRED_CONTENT_FOR_ARGUMENTS, RESERVED_CONTENT_FOR_ARGUMENTS,
};
use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Markup, Node, NodeKind, NodeRef};

pub static VALID_CONTENT_FOR_ARGUMENTS: CheckDef = CheckDef {
    code: "ValidContentForArguments",
    name: "Prevent the use of invalid arguments to the content_for tag",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// `Object.prototype` methods that throw when `validationStrategies[type]` picks them up and
/// calls them with an undefined `this` (`constructor` and `toString` don't).
const THROWING_PROTOTYPE_KEYS: &[&str] = &[
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "valueOf",
    "__proto__",
    "toLocaleString",
];

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        if tag.name != "content_for" {
            return Ok(());
        }
        let Markup::Node(markup) = &tag.markup else {
            return Ok(());
        };
        let Node::ContentForMarkup(node) = markup.as_ref() else {
            return Ok(());
        };

        match &*node.content_for_type.value {
            "blocks" => {
                for arg in node
                    .args
                    .iter()
                    .filter(|a| !a.name.starts_with(CLOSEST_ARGUMENT))
                {
                    cx.report(
                        r#"{% content_for "blocks" %} only accepts 'closest.*' arguments"#,
                        arg.position.start,
                        arg.position.end,
                    );
                }
            }
            "block" => {
                for &required in REQUIRED_CONTENT_FOR_ARGUMENTS {
                    let Some(arg) = node.args.iter().find(|a| a.name == required) else {
                        let message = format!(
                            r#"{{% content_for "block" %}} requires a '{required}' argument"#
                        );
                        cx.report_with(
                            message,
                            node.position.start,
                            node.position.end,
                            None,
                            Some(Vec::new()),
                        );
                        continue;
                    };
                    if !matches!(arg.value.as_ref(), Node::String(_)) {
                        let p = arg.value.position();
                        cx.report_with(
                            format!("The '{required}' argument should be a string"),
                            p.start,
                            p.end,
                            None,
                            Some(Vec::new()),
                        );
                    }
                }
                for arg in node
                    .args
                    .iter()
                    .filter(|a| RESERVED_CONTENT_FOR_ARGUMENTS.contains(&&*a.name))
                {
                    let message = format!(
                        r#"{{% content_for "block" %}} doesn't support '{}' because it's a reserved argument."#,
                        arg.name
                    );
                    cx.report(message, arg.position.start, arg.position.end);
                }
            }
            t if THROWING_PROTOTYPE_KEYS.contains(&t) => {
                return Err(CheckError::new(format!(
                    "validationStrategies.{t} threw on an undefined this"
                )));
            }
            _ => {}
        }
        Ok(())
    }
}
