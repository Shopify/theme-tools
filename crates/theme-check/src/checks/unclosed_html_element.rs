//! `checks/unclosed-html-element/index.ts`

use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{HtmlElement, LiquidBranch, LiquidTag, Markup, Node, NodeKind, NodeRef};
use std::collections::HashMap;
use std::fmt::Write;

pub static UNCLOSED_HTML_ELEMENT: CheckDef = CheckDef {
    code: "UnclosedHTMLElement",
    name: "Unclosed HTML Element",
    aliases: &["UnclosedHTMLElement"],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

/// The dangling open (`HtmlElement`) and close (`HtmlDanglingMarkerClose`) nodes under one
/// grandparent, by condition identifier in insertion order. TS keeps opens and closes in
/// separate maps but concatenates and sorts them by position before use, so one list does.
struct Stacks<'a> {
    grandparent: NodeRef<'a>,
    nodes_by_identifier: Vec<(String, Vec<NodeRef<'a>>)>,
}

/// See the TS file for the algorithm: unclosed nodes are grouped by parent condition and
/// grandparent node, and each group must balance out by the end of the file.
#[derive(Default)]
struct Check<'a> {
    stacks_by_grandparent: Vec<Stacks<'a>>,
    /// Grandparent address to its index in `stacks_by_grandparent`.
    grandparent_index: HashMap<usize, usize>,
}

fn create<'a>(_: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::<Check>::default())
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::HtmlElement.bit() | NodeKind::HtmlDanglingMarkerClose.bit()
    }

    fn node(
        &mut self,
        node: NodeRef<'a>,
        ancestors: &[NodeRef<'a>],
        _: &mut Context<'a>,
    ) -> CheckResult {
        if matches!(node, NodeRef::HtmlElement(el) if is_closed(el)) {
            return Ok(());
        }
        let Some(index) = ancestors
            .iter()
            .rposition(|a| matches!(a, NodeRef::LiquidBranch(_)))
        else {
            return Ok(());
        };
        let NodeRef::LiquidBranch(branch) = ancestors[index] else {
            unreachable!()
        };
        let (Some(NodeRef::LiquidTag(parent)), Some(&grandparent)) = (
            index.checked_sub(1).map(|i| ancestors[i]),
            index.checked_sub(2).map(|i| &ancestors[i]),
        ) else {
            return Ok(());
        };

        let stacks = &mut self.stacks_by_grandparent;
        let i = *self
            .grandparent_index
            .entry(grandparent.addr())
            .or_insert_with(|| {
                stacks.push(Stacks {
                    grandparent,
                    nodes_by_identifier: Vec::new(),
                });
                stacks.len() - 1
            });

        let identifier = condition_identifier(branch, parent)?;
        let by_identifier = &mut stacks[i].nodes_by_identifier;
        match by_identifier.iter_mut().find(|(id, _)| *id == identifier) {
            Some((_, nodes)) => nodes.push(node),
            None => by_identifier.push((identifier, vec![node])),
        }
        Ok(())
    }

    fn on_code_path_end(&mut self, cx: &mut Context<'a>) -> CheckResult {
        let source = cx.source();
        for stacks in &mut self.stacks_by_grandparent {
            // First pass: match opens/closes within each condition identifier.
            for (_, nodes) in &mut stacks.nodes_by_identifier {
                nodes.sort_by_key(|n| n.position().start);
                balance_open_close_tags(nodes, source);
            }

            // Second pass: try to balance unmatched opens from one condition identifier against
            // unmatched closes from sibling condition identifiers within the same grandparent.
            //
            // This handles patterns where an open tag is inside one condition (e.g.
            // `{% if forloop.first %}`) and the matching close is inside a sibling condition
            // (e.g. `{% if forloop.last %}`).
            let mut all_unmatched: Vec<_> = stacks
                .nodes_by_identifier
                .iter()
                .flat_map(|(_, n)| n.iter().copied())
                .collect();
            all_unmatched.sort_by_key(|n| n.position().start);
            balance_open_close_tags(&mut all_unmatched, source);
            // Nodes not left here were resolved and should not be reported.
            let mut cross_balanced_remaining: Vec<usize> =
                all_unmatched.iter().map(|n| n.addr()).collect();
            cross_balanced_remaining.sort_unstable();

            let grandparent_type = stacks.grandparent.type_name();
            let grandparent_name = get_name(stacks.grandparent, source);
            for (identifier, unmatched) in &stacks.nodes_by_identifier {
                for node in unmatched {
                    if cross_balanced_remaining
                        .binary_search(&node.addr())
                        .is_err()
                    {
                        continue;
                    }
                    match node {
                        NodeRef::HtmlDanglingMarkerClose(n) => cx.report(
                            format!("Closing tag does not have a matching opening tag for condition `{identifier}` in {grandparent_type} '{grandparent_name}'"),
                            n.position.start,
                            n.position.end,
                        ),
                        NodeRef::HtmlElement(n) => cx.report(
                            format!("Opening tag does not have a matching closing tag for condition `{identifier}` in {grandparent_type} '{grandparent_name}'"),
                            n.block_start_position.start,
                            n.block_start_position.end,
                        ),
                        _ => {}
                    }
                }
            }
        }
        Ok(())
    }
}

fn is_closed(node: &HtmlElement) -> bool {
    node.block_end_position.start != node.block_end_position.end
}

fn condition_identifier(branch: &LiquidBranch, parent: &LiquidTag) -> Result<String, CheckError> {
    let mut out = String::new();
    let Some(branch_name) = branch.name.as_deref() else {
        match &*parent.name {
            "if" => markup_identifier(&parent.markup, &mut out)?,
            "unless" => {
                return markup_identifier(&parent.markup, &mut out).map(|()| negate_identifier(out))
            }
            _ => out.push_str("??"),
        }
        return Ok(out);
    };

    match (branch_name, &*parent.name) {
        ("else", "if") => {
            return markup_identifier(&parent.markup, &mut out).map(|()| negate_identifier(out))
        }
        ("else", "unless") => markup_identifier(&parent.markup, &mut out)?,
        ("else", "case") => {
            out.push_str("case ");
            markup_identifier(&parent.markup, &mut out)?;
        }
        ("elsif", _) => markup_identifier(&branch.markup, &mut out)?,
        ("when", "case") => {
            out.push_str("case ");
            markup_identifier(&parent.markup, &mut out)?;
            out.push_str(" == ");
            // getConditionIdentifierForWhenMarkup
            match &branch.markup {
                Markup::Nodes(conditions) => {
                    for (i, condition) in conditions.iter().enumerate() {
                        if i > 0 {
                            out.push_str(" or ");
                        }
                        condition_identifier_for(condition, &mut out)?;
                    }
                }
                markup => markup_identifier(markup, &mut out)?,
            }
        }
        _ => out.push_str("??"),
    }
    Ok(out)
}

/// `getConditionIdentifierForMarkup(condition)` for a string or node markup.
fn markup_identifier(markup: &Markup, out: &mut String) -> CheckResult {
    match markup {
        Markup::Str(s) => out.push_str(s),
        Markup::Node(n) => condition_identifier_for(n, out)?,
        Markup::Nodes(_) => return Err(never_reached()),
        Markup::Null => {
            return Err(CheckError::new(
                "Cannot read properties of null (reading 'type')",
            ))
        }
    }
    Ok(())
}

fn condition_identifier_for(condition: &Node, out: &mut String) -> CheckResult {
    match condition {
        Node::String(s) => {
            out.push('\'');
            out.push_str(&s.value);
            out.push('\'');
        }
        // `condition.value.toString()`, where `value` is `LiquidLiteralValues[keyword]`.
        Node::LiquidLiteral(l) => match l.keyword {
            "nil" | "null" => out.push_str("null"),
            "blank" | "empty" => {}
            "true" | "false" => out.push_str(l.keyword),
            "__proto__" => out.push_str("[object Object]"),
            "constructor" => out.push_str("function Object() { [native code] }"),
            proto => {
                let _ = write!(out, "function {proto}() {{ [native code] }}");
            }
        },
        Node::Number(n) => out.push_str(&n.value),
        Node::VariableLookup(v) => {
            out.push_str(v.name.as_deref().unwrap_or(""));
            for (i, lookup) in v.lookups.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push('[');
                condition_identifier_for(lookup, out)?;
                out.push(']');
            }
        }
        Node::Range(r) => {
            out.push('(');
            condition_identifier_for(&r.start, out)?;
            out.push_str("..");
            condition_identifier_for(&r.end, out)?;
            out.push(')');
        }
        Node::Comparison(c) => {
            condition_identifier_for(&c.left, out)?;
            let _ = write!(out, " {} ", c.comparator);
            condition_identifier_for(&c.right, out)?;
        }
        Node::LogicalExpression(c) => {
            condition_identifier_for(&c.left, out)?;
            let _ = write!(out, " {} ", c.relation);
            condition_identifier_for(&c.right, out)?;
        }
        _ => return Err(never_reached()),
    }
    Ok(())
}

/// `assertNever(condition)` on an object.
fn never_reached() -> CheckError {
    CheckError::new("We should never reach this code, you are missing a case for [object Object]")
}

fn negate_identifier(identifier: String) -> String {
    match identifier.strip_prefix('-') {
        Some(rest) => rest.to_string(),
        None => format!("-{identifier}"),
    }
}

/// `balanceOpenCloseTags(sortedNodes)`, in place: leaves the unmatched nodes.
fn balance_open_close_tags<'a>(nodes: &mut Vec<NodeRef<'a>>, source: &'a str) {
    let mut len = 0;
    for i in 0..nodes.len() {
        let node = nodes[i];
        if matches!(node, NodeRef::HtmlDanglingMarkerClose(_))
            && len > 0
            && matches!(nodes[len - 1], NodeRef::HtmlElement(_))
            && get_name(node, source) == get_name(nodes[len - 1], source)
        {
            len -= 1;
        } else {
            nodes[len] = node;
            len += 1;
        }
    }
    nodes.truncate(len);
}

fn get_name<'a>(node: NodeRef<'a>, source: &'a str) -> &'a str {
    let name = match node {
        NodeRef::HtmlElement(n) => &n.name,
        NodeRef::HtmlDanglingMarkerClose(n) => &n.name,
        NodeRef::LiquidTag(n) => return &n.name,
        _ => return node.type_name(),
    };
    match (name.first(), name.last()) {
        (Some(first), Some(last)) => &source[first.position().start..last.position().end],
        _ => "",
    }
}
