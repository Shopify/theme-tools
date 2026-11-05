use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{Node, NodeKind, NodeRef};

pub static VALID_STANDARD_EVENT_DATA: CheckDef = CheckDef {
    code: "ValidStandardEventData",
    name: "Prevent the use of invalid arguments to the standard_event_data filter",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

const SUPPORTED_EVENT_TYPE: &str = "view";
const PRODUCT_CONTEXTS: &[&str] = &["page", "search", "collection", "dialog", "recommendation"];
const CART_CONTEXTS: &[&str] = &["page", "dialog"];
/// `[...new Set(Object.values(SUPPORTED_CONTEXTS_BY_DROP).flat())]`
const ANY_INPUT_CONTEXTS: &[&str] = &["page", "search", "collection", "dialog", "recommendation"];
const DROPS_THAT_IGNORE_CONTEXT: &[&str] = &["collection"];

/// `Object.prototype` keys: `SUPPORTED_CONTEXTS_BY_DROP[drop]` finds these too.
const OBJECT_PROTOTYPE_KEYS: &[&str] = &[
    "constructor",
    "__defineGetter__",
    "__defineSetter__",
    "hasOwnProperty",
    "__lookupGetter__",
    "__lookupSetter__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toString",
    "valueOf",
    "__proto__",
    "toLocaleString",
];

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

/// `isInvalidStaticValue(value, supportedValues)`
fn is_invalid_static_value(value: &Node, supported: &[&str]) -> bool {
    match value {
        Node::VariableLookup(_) => false,
        Node::String(s) => !supported.contains(&s.value.as_ref()),
        _ => true,
    }
}

/// `describeValue(value)`
fn describe_value(value: &Node) -> String {
    match value {
        Node::String(s) => format!(" '{}'", s.value),
        _ => String::new(),
    }
}

impl<'a> LiquidCheck<'a> for Check {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidFilter.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        cx: &mut Context<'a>,
    ) -> CheckResult {
        let NodeRef::LiquidFilter(f) = node else {
            return Ok(());
        };
        if f.name != "standard_event_data" {
            return Ok(());
        }

        if let Some(event_type) = f.args.iter().find(|a| !matches!(a, Node::NamedArgument(_))) {
            if is_invalid_static_value(event_type, &[SUPPORTED_EVENT_TYPE]) {
                let p = event_type.position();
                cx.report(
                    format!(
                        "Unsupported event type{}. The only supported event type is '{SUPPORTED_EVENT_TYPE}'.",
                        describe_value(event_type)
                    ),
                    p.start,
                    p.end,
                );
            }
        }

        // detectInputDrop(node, parent): a bare variable that this filter is applied to first.
        let drop = match ancestors.last() {
            Some(NodeRef::LiquidVariable(parent))
                if parent
                    .filters
                    .first()
                    .is_some_and(|first| std::ptr::eq(first, f)) =>
            {
                match parent.expression.as_ref() {
                    Node::VariableLookup(v) if v.lookups.is_empty() => {
                        v.name.as_deref().filter(|n| !n.is_empty())
                    }
                    _ => None,
                }
            }
            _ => None,
        };
        if drop.is_some_and(|d| DROPS_THAT_IGNORE_CONTEXT.contains(&d)) {
            return Ok(());
        }

        let Some(context_value) = f.args.iter().find_map(|a| match a {
            Node::NamedArgument(n) if n.name == "context" => Some(n.value.as_ref()),
            _ => None,
        }) else {
            return Ok(());
        };

        let by_drop = match drop {
            Some("product") => Some(PRODUCT_CONTEXTS),
            Some("cart") => Some(CART_CONTEXTS),
            // An inherited Object.prototype function: `.includes`/`.join` on it throw.
            Some(d) if OBJECT_PROTOTYPE_KEYS.contains(&d) => {
                if matches!(context_value, Node::VariableLookup(_)) {
                    return Ok(());
                }
                let method = if matches!(context_value, Node::String(_)) {
                    "includes"
                } else {
                    "join"
                };
                return Err(CheckError::new(format!(
                    "supportedContexts.{method} is not a function"
                )));
            }
            _ => None,
        };
        let supported = by_drop.unwrap_or(ANY_INPUT_CONTEXTS);
        if is_invalid_static_value(context_value, supported) {
            let drop_description = match (drop, by_drop) {
                (Some(d), Some(_)) => format!(" for {d}"),
                _ => String::new(),
            };
            let p = context_value.position();
            cx.report(
                format!(
                    "Unsupported context{}{drop_description}. Valid values: {}. The 'context' argument can also be omitted.",
                    describe_value(context_value),
                    supported.join(", ")
                ),
                p.start,
                p.end,
            );
        }
        Ok(())
    }
}
