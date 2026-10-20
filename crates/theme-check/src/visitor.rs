//! `visitor.ts`: `visit` (as an iterator) and `findCurrentNode`.

use liquid_ast::{NodeRef, Position};

/// The nodes `visit(node, visitor)` visits, in its order (preorder, same as the check walker).
/// `walk(root).filter_map(...)` is TS `visit(root, { Type: (node) => ... })`. Use
/// `liquid_ast::visit_liquid` when you need the ancestors.
pub fn walk<'a>(root: NodeRef<'a>) -> Walk<'a> {
    Walk {
        stack: vec![(root, 0)],
    }
}

pub struct Walk<'a> {
    stack: Vec<(NodeRef<'a>, usize)>,
}

impl<'a> Iterator for Walk<'a> {
    type Item = NodeRef<'a>;
    fn next(&mut self) -> Option<NodeRef<'a>> {
        let (node, _) = self.stack.pop()?;
        node.push_children(&mut self.stack, 0);
        Some(node)
    }
}

/// `findCurrentNode(ast, cursorPosition)` (byte offsets).
pub fn find_current_node<'a>(ast: NodeRef<'a>, cursor: usize) -> (NodeRef<'a>, Vec<NodeRef<'a>>) {
    let mut current = ast;
    let mut ancestors: Vec<NodeRef<'a>> = Vec::new();
    let mut children = Vec::new();
    loop {
        let prev = current;
        children.clear();
        // forEachChildNodes order is push order.
        current.push_children(&mut children, 0);
        let mut moved = false;
        for &(child, _) in &children {
            if is_unclosed(child) || (is_covered(child, cursor) && size(child) <= size(current)) {
                current = child;
                moved = true;
            }
        }
        if !moved {
            break;
        }
        ancestors.push(prev);
    }
    (current, ancestors)
}

fn is_covered(node: NodeRef, offset: usize) -> bool {
    let p = node.position();
    match node {
        NodeRef::String(_)
        | NodeRef::VariableLookup(_)
        | NodeRef::LogicalExpression(_)
        | NodeRef::Comparison(_) => p.start <= offset && offset <= p.end,
        _ => p.start < offset && offset <= p.end,
    }
}

fn size(node: NodeRef) -> isize {
    let p = node.position();
    p.end as isize - p.start as isize
}

fn unclosed(p: Position) -> bool {
    p.end == usize::MAX
}

/// `isUnclosed`: `blockEndPosition?.end === -1`, else non-empty `children`.
fn is_unclosed(node: NodeRef) -> bool {
    match node {
        NodeRef::LiquidRawTag(n) => unclosed(n.block_end_position),
        NodeRef::LiquidBranch(n) => unclosed(n.block_end_position),
        NodeRef::HtmlElement(n) => unclosed(n.block_end_position),
        NodeRef::HtmlRawNode(n) => unclosed(n.block_end_position),
        NodeRef::LiquidTag(n) => match n.block_end_position {
            Some(p) => unclosed(p),
            None => n.children.as_ref().is_some_and(|c| !c.is_empty()),
        },
        NodeRef::Document(n) => !n.children.is_empty(),
        _ => false,
    }
}
