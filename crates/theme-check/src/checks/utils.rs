//! `checks/utils.ts`

use crate::js;
use liquid_ast::{Attr, AttrEmpty, Markup, Node, NodeRef};

/// TS `ValuedHtmlAttribute | AttrEmpty`, borrowed from an attribute `Node`.
#[derive(Clone, Copy)]
pub enum HtmlAttr<'a> {
    Valued(&'a Attr<'a>),
    Empty(&'a AttrEmpty<'a>),
}

impl<'a> HtmlAttr<'a> {
    pub fn name(&self) -> &'a [Node<'a>] {
        match self {
            HtmlAttr::Valued(a) => &a.name,
            HtmlAttr::Empty(a) => &a.name,
        }
    }
}

/// `isHtmlAttribute(attr)`: Attr{Unquoted,DoubleQuoted,SingleQuoted,Empty}.
pub fn html_attribute<'a>(attr: &'a Node<'a>) -> Option<HtmlAttr<'a>> {
    match attr {
        Node::AttrUnquoted(a) | Node::AttrDoubleQuoted(a) | Node::AttrSingleQuoted(a) => {
            Some(HtmlAttr::Valued(a))
        }
        Node::AttrEmpty(a) => Some(HtmlAttr::Empty(a)),
        _ => None,
    }
}

/// `isValuedHtmlAttribute(attr)`
pub fn valued_html_attribute<'a>(attr: &'a Node<'a>) -> Option<&'a Attr<'a>> {
    match attr {
        Node::AttrUnquoted(a) | Node::AttrDoubleQuoted(a) | Node::AttrSingleQuoted(a) => Some(a),
        _ => None,
    }
}

/// The single static TextNode of a compound name (`[TextNode]`), if that's what it is.
fn single_text<'a>(nodes: &'a [Node<'a>]) -> Option<&'a str> {
    match nodes {
        [Node::TextNode(t)] => Some(&t.value),
        _ => None,
    }
}

/// `isAttr(attr, name)`
pub fn is_attr(attr_name: &[Node], name: &str) -> bool {
    single_text(attr_name) == Some(name)
}

/// `hasAttributeValueOf(attr, value)`
pub fn has_attribute_value_of(attr: &Attr, value: &str) -> bool {
    single_text(&attr.value) == Some(value)
}

/// `valueIncludes(attr, word)`: some TextNode value has `word` as a whitespace-separated token.
pub fn value_includes(attr: &Attr, word: &str) -> bool {
    attr.value
        .iter()
        .any(|n| matches!(n, Node::TextNode(t) if t.value.split(js::is_space).any(|w| w == word)))
}

/// `getHtmlNodeName(node)` for HtmlElement / HtmlSelfClosingElement / HtmlVoidElement /
/// HtmlRawNode; `None` for dynamic names and other nodes.
pub fn get_html_node_name<'a>(node: NodeRef<'a>) -> Option<&'a str> {
    match node {
        NodeRef::HtmlVoidElement(n) => Some(&n.name),
        NodeRef::HtmlRawNode(n) => Some(&n.name),
        NodeRef::HtmlElement(n) => single_text(&n.name),
        NodeRef::HtmlSelfClosingElement(n) => single_text(&n.name),
        _ => None,
    }
}

/// `isHtmlTag(node, name)`: an HtmlElement with that static name (`blockEndPosition` is always
/// set in the Rust AST).
pub fn is_html_tag(node: NodeRef, name: &str) -> bool {
    matches!(node, NodeRef::HtmlElement(n) if single_text(&n.name) == Some(name))
}

/// `isLoopLiquidTag(tag)`: `for` / `tablerow`.
pub fn is_loop_tag_name(name: &str) -> bool {
    name == "for" || name == "tablerow"
}

/// `isLoopScopedVariable(variableName, ancestors)`
pub fn is_loop_scoped_variable(variable_name: &str, ancestors: &[NodeRef]) -> bool {
    ancestors.iter().any(|a| match a {
        NodeRef::LiquidTag(t) if is_loop_tag_name(&t.name) => {
            matches!(&t.markup, Markup::Node(m) if matches!(m.as_ref(), Node::ForMarkup(f) if f.variable_name == variable_name))
        }
        _ => false,
    })
}

const RAW_TAGS_THAT_DO_NOT_PARSE_THEIR_CONTENTS: &[&str] =
    &["raw", "stylesheet", "javascript", "schema"];

/// `isWithinRawTagThatDoesNotParseItsContents(ancestors)`
pub fn is_within_raw_tag_that_does_not_parse_its_contents(ancestors: &[NodeRef]) -> bool {
    ancestors
        .iter()
        .any(|a| matches!(a, NodeRef::LiquidRawTag(t) if RAW_TAGS_THAT_DO_NOT_PARSE_THEIR_CONTENTS.contains(&t.name.as_ref())))
}
