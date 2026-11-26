//! `blockTagSyntaxError` callers' shared guard. The function itself lives with its TS home in
//! `liquid_syntax_error::block`.

use liquid_ast::{BlockMarkup, LiquidTag, Node};

pub use super::liquid_syntax_error::block::block_tag_syntax_error;

/// `node.name === 'block' && !blockTagSyntaxError(node)`, then `node.markup as BlockMarkup`.
pub fn valid_block_markup<'a>(
    node: &'a LiquidTag<'a>,
    source: &str,
) -> Option<&'a BlockMarkup<'a>> {
    if node.name != "block" || block_tag_syntax_error(node, source).is_some() {
        return None;
    }
    match node.markup.node() {
        Some(Node::BlockMarkup(m)) => Some(m),
        _ => None,
    }
}
