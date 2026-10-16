//! Port of `src/document/factories.ts`.
//!
//! Offsets are byte offsets into the source. The `source` and `_source` keys
//! hold `Null`, which `hydrate` overwrites with the source string. Every
//! optional TS parameter left out is `JsVal::Undefined`, so its key is still
//! present, as in the TS object literal.

use crate::ast::RawMarkupKinds;
use crate::document::tokenizer::Token;
use crate::js::{js_is_whitespace, js_trim, js_trim_start};
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

/// TS `LiquidTagEnvelope`. `source` is not carried: every node takes `Null`.
#[derive(Clone)]
pub struct LiquidTagEnvelope {
    pub tag_name: String,
    pub markup_string: String,
    pub markup_offset: usize,
    /// The end of the markup in the source (exclusive), aligned with
    /// `markup_offset`.
    pub markup_end: usize,
    pub whitespace_start: &'static str,
    pub whitespace_end: &'static str,
    pub block_start_position: JsVal,
}

/// TS `{ start: LiquidOpenWhitespace; end: LiquidCloseWhitespace }`.
#[derive(Clone, Copy)]
pub struct DelimiterWhitespace {
    pub start: &'static str,
    pub end: &'static str,
}

fn node_type(kind: NodeTypes) -> JsVal {
    JsVal::str(kind.as_str())
}

/// TS `token.end - token.start > 2 ? '-' : ''` for a Liquid delimiter.
pub fn delimiter_whitespace(token: Token) -> &'static str {
    if token.end - token.start > 2 { "-" } else { "" }
}

pub fn make_document_node(children: Vec<JsVal>, source: &str) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::Document),
        "children" => JsVal::array(children),
        "name" => JsVal::str("#document"),
        "_source" => JsVal::Null,
        "position" => JsVal::position(0, source.len()),
        "source" => JsVal::Null,
    }
}

pub fn envelope_from_tokens(
    open_token: Token,
    close_token: Token,
    source: &str,
) -> LiquidTagEnvelope {
    let inner = &source[open_token.end..close_token.start];
    let trimmed = js_trim_start(inner);
    let leading_spaces = inner.len() - trimmed.len();

    // TS `trimmed.search(/\s/)`
    let tag_name = match trimmed.find(js_is_whitespace) {
        None => js_trim(trimmed),
        Some(first_whitespace) => &trimmed[..first_whitespace],
    };

    let tag_name_start_in_inner = leading_spaces;
    let after_tag_name = tag_name_start_in_inner + tag_name.len();
    let markup_string = &inner[after_tag_name..];

    // markupOffset points to the first non-whitespace character of the markup in source
    let bytes = inner.as_bytes();
    let mut markup_offset_in_inner = after_tag_name;
    while markup_offset_in_inner < inner.len()
        && (bytes[markup_offset_in_inner] == b' ' || bytes[markup_offset_in_inner] == b'\t')
    {
        markup_offset_in_inner += 1;
    }
    let markup_offset = open_token.end + markup_offset_in_inner;

    LiquidTagEnvelope {
        tag_name: tag_name.to_string(),
        markup_string: markup_string.to_string(),
        markup_offset,
        markup_end: close_token.start,
        whitespace_start: delimiter_whitespace(open_token),
        whitespace_end: delimiter_whitespace(close_token),
        block_start_position: JsVal::position(open_token.start, close_token.end),
    }
}

fn delimiter_start(delimiter_whitespace: Option<DelimiterWhitespace>) -> JsVal {
    delimiter_whitespace.map_or(JsVal::Undefined, |ws| JsVal::str(ws.start))
}

fn delimiter_end(delimiter_whitespace: Option<DelimiterWhitespace>) -> JsVal {
    delimiter_whitespace.map_or(JsVal::Undefined, |ws| JsVal::str(ws.end))
}

/// TS `blockEndPosition ? blockEndPosition.end : envelope.blockStartPosition.end`.
fn position_end(envelope: &LiquidTagEnvelope, block_end_position: &JsVal) -> usize {
    match block_end_position {
        JsVal::Undefined => envelope.block_start_position.get("end").offset(),
        position => position.get("end").offset(),
    }
}

/// `children` and `block_end_position` are `Undefined` when TS leaves them
/// out. `#`-comment lines in `{% liquid %}` keep their inner indentation
/// verbatim (`preserve_markup`); every other base-case tag trims.
pub fn make_liquid_tag_base_case(
    envelope: &LiquidTagEnvelope,
    children: JsVal,
    block_end_position: JsVal,
    delimiter_whitespace: Option<DelimiterWhitespace>,
    reason: Option<String>,
    preserve_markup: bool,
) -> JsVal {
    let pos_end = position_end(envelope, &block_end_position);
    let markup = if preserve_markup {
        envelope.markup_string.as_str()
    } else {
        js_trim(&envelope.markup_string)
    };
    obj! {
        "type" => node_type(NodeTypes::LiquidTag),
        "name" => JsVal::str(&envelope.tag_name),
        "markup" => JsVal::str(markup),
        "children" => children,
        "whitespaceStart" => JsVal::str(envelope.whitespace_start),
        "whitespaceEnd" => JsVal::str(envelope.whitespace_end),
        "delimiterWhitespaceStart" => delimiter_start(delimiter_whitespace),
        "delimiterWhitespaceEnd" => delimiter_end(delimiter_whitespace),
        "blockStartPosition" => envelope.block_start_position.clone(),
        "blockEndPosition" => block_end_position,
        "markupPosition" => JsVal::position(envelope.markup_offset, envelope.markup_end),
        "position" => JsVal::position(envelope.block_start_position.get("start").offset(), pos_end),
        "source" => JsVal::Null,
        "reason" => reason.map_or(JsVal::Undefined, JsVal::Str),
    }
}

/// TS `makeLiquidTagBaseCase(envelope)` with every optional argument left out.
pub fn make_liquid_tag_base_case_bare(
    envelope: &LiquidTagEnvelope,
    reason: Option<String>,
) -> JsVal {
    make_liquid_tag_base_case(
        envelope,
        JsVal::Undefined,
        JsVal::Undefined,
        None,
        reason,
        false,
    )
}

pub fn make_liquid_tag_named(
    envelope: &LiquidTagEnvelope,
    markup: JsVal,
    children: JsVal,
    block_end_position: JsVal,
    delimiter_whitespace: Option<DelimiterWhitespace>,
) -> JsVal {
    let pos_end = position_end(envelope, &block_end_position);
    obj! {
        "type" => node_type(NodeTypes::LiquidTag),
        "name" => JsVal::str(&envelope.tag_name),
        "markup" => markup,
        "children" => children,
        "whitespaceStart" => JsVal::str(envelope.whitespace_start),
        "whitespaceEnd" => JsVal::str(envelope.whitespace_end),
        "delimiterWhitespaceStart" => delimiter_start(delimiter_whitespace),
        "delimiterWhitespaceEnd" => delimiter_end(delimiter_whitespace),
        "blockStartPosition" => envelope.block_start_position.clone(),
        "blockEndPosition" => block_end_position,
        "markupPosition" => JsVal::position(envelope.markup_offset, envelope.markup_end),
        "position" => JsVal::position(envelope.block_start_position.get("start").offset(), pos_end),
        "source" => JsVal::Null,
    }
}

/// TS sets `blockEndPosition` to `{ start: -1, end: -1 }`. Every branch goes
/// through `finalize_branch` before it is stored, and that replaces the value,
/// so the placeholder here is never emitted.
fn unfinalized_block_end_position() -> JsVal {
    JsVal::Null
}

pub fn make_liquid_branch_unnamed(body_start: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::LiquidBranch),
        "name" => JsVal::Null,
        "markup" => JsVal::str(""),
        "children" => JsVal::array(Vec::new()),
        "whitespaceStart" => JsVal::str(""),
        "whitespaceEnd" => JsVal::str(""),
        "markupPosition" => JsVal::position(body_start, body_start),
        "blockStartPosition" => JsVal::position(body_start, body_start),
        "blockEndPosition" => unfinalized_block_end_position(),
        "position" => JsVal::position(body_start, body_start),
        "source" => JsVal::Null,
    }
}

pub fn make_liquid_branch_named(envelope: &LiquidTagEnvelope, markup: JsVal) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::LiquidBranch),
        "name" => JsVal::str(&envelope.tag_name),
        "markup" => markup,
        "children" => JsVal::array(Vec::new()),
        "whitespaceStart" => JsVal::str(envelope.whitespace_start),
        "whitespaceEnd" => JsVal::str(envelope.whitespace_end),
        "markupPosition" => JsVal::position(envelope.markup_offset, envelope.markup_end),
        "blockStartPosition" => envelope.block_start_position.clone(),
        "blockEndPosition" => unfinalized_block_end_position(),
        "position" => JsVal::position(
            envelope.block_start_position.get("start").offset(),
            envelope.block_start_position.get("end").offset(),
        ),
        "source" => JsVal::Null,
    }
}

pub fn make_liquid_raw_tag(
    envelope: &LiquidTagEnvelope,
    source: &str,
    body: JsVal,
    block_end_position: JsVal,
    delimiter_whitespace: DelimiterWhitespace,
) -> JsVal {
    // TS `envelope.source[markupEnd - 1] === ' '`: a single-unit compare with
    // an ASCII char, so a byte compare gives the same answer.
    let bytes = source.as_bytes();
    let mut markup_end = envelope.markup_end;
    while markup_end > envelope.markup_offset
        && (bytes[markup_end - 1] == b' ' || bytes[markup_end - 1] == b'\t')
    {
        markup_end -= 1;
    }

    let end = block_end_position.get("end").offset();
    obj! {
        "type" => node_type(NodeTypes::LiquidRawTag),
        "name" => JsVal::str(&envelope.tag_name),
        "markup" => JsVal::str(js_trim(&envelope.markup_string)),
        "markupPosition" => JsVal::position(envelope.markup_offset, markup_end),
        "body" => body,
        "whitespaceStart" => JsVal::str(envelope.whitespace_start),
        "whitespaceEnd" => JsVal::str(envelope.whitespace_end),
        "delimiterWhitespaceStart" => JsVal::str(delimiter_whitespace.start),
        "delimiterWhitespaceEnd" => JsVal::str(delimiter_whitespace.end),
        "blockStartPosition" => envelope.block_start_position.clone(),
        "blockEndPosition" => block_end_position,
        "position" => JsVal::position(envelope.block_start_position.get("start").offset(), end),
        "source" => JsVal::Null,
    }
}

/// `markup` is a string or a `LiquidVariable`.
pub fn make_liquid_variable_output(open_token: Token, close_token: Token, markup: JsVal) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::LiquidVariableOutput),
        "markup" => markup,
        "whitespaceStart" => JsVal::str(delimiter_whitespace(open_token)),
        "whitespaceEnd" => JsVal::str(delimiter_whitespace(close_token)),
        "markupPosition" => JsVal::position(open_token.end, close_token.start),
        "position" => JsVal::position(open_token.start, close_token.end),
        "source" => JsVal::Null,
    }
}

pub fn make_text_node(value: &str, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::TextNode),
        "value" => JsVal::str(value),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_raw_markup(
    kind: RawMarkupKinds,
    value: &str,
    nodes: Vec<JsVal>,
    start: usize,
    end: usize,
) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::RawMarkup),
        "kind" => JsVal::str(kind.as_str()),
        "value" => JsVal::str(value),
        "nodes" => JsVal::array(nodes),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_yaml_frontmatter(body: &str, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::YAMLFrontmatter),
        "body" => JsVal::str(body),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_html_element(
    name: Vec<JsVal>,
    attributes: Vec<JsVal>,
    children: Vec<JsVal>,
    block_start_position: JsVal,
    block_end_position: JsVal,
) -> JsVal {
    let position = JsVal::position(
        block_start_position.get("start").offset(),
        block_end_position.get("end").offset(),
    );
    obj! {
        "type" => node_type(NodeTypes::HtmlElement),
        "name" => JsVal::array(name),
        "attributes" => JsVal::array(attributes),
        "children" => JsVal::array(children),
        "blockStartPosition" => block_start_position,
        "blockEndPosition" => block_end_position,
        "position" => position,
        "source" => JsVal::Null,
    }
}

/// `position` is the `blockStartPosition` object itself, as in TS.
pub fn make_html_void_element(
    name: &str,
    attributes: Vec<JsVal>,
    block_start_position: JsVal,
) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::HtmlVoidElement),
        "name" => JsVal::str(name),
        "attributes" => JsVal::array(attributes),
        "blockStartPosition" => block_start_position.clone(),
        "position" => block_start_position,
        "source" => JsVal::Null,
    }
}

/// `position` is the `blockStartPosition` object itself, as in TS.
pub fn make_html_self_closing_element(
    name: Vec<JsVal>,
    attributes: Vec<JsVal>,
    block_start_position: JsVal,
) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::HtmlSelfClosingElement),
        "name" => JsVal::array(name),
        "attributes" => JsVal::array(attributes),
        "blockStartPosition" => block_start_position.clone(),
        "position" => block_start_position,
        "source" => JsVal::Null,
    }
}

pub fn make_html_raw_node(
    name: &str,
    attributes: Vec<JsVal>,
    body: JsVal,
    block_start_position: JsVal,
    block_end_position: JsVal,
) -> JsVal {
    let position = JsVal::position(
        block_start_position.get("start").offset(),
        block_end_position.get("end").offset(),
    );
    obj! {
        "type" => node_type(NodeTypes::HtmlRawNode),
        "name" => JsVal::str(name),
        "attributes" => JsVal::array(attributes),
        "body" => body,
        "blockStartPosition" => block_start_position,
        "blockEndPosition" => block_end_position,
        "position" => position,
        "source" => JsVal::Null,
    }
}

pub fn make_html_comment(body: &str, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::HtmlComment),
        "body" => JsVal::str(body),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

/// `legacy_doctype_string` is `None` for TS `null`.
pub fn make_html_doctype(legacy_doctype_string: Option<&str>, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::HtmlDoctype),
        "legacyDoctypeString" => legacy_doctype_string.map_or(JsVal::Null, JsVal::str),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

fn make_attr_with_value(
    kind: NodeTypes,
    name: Vec<JsVal>,
    value: Vec<JsVal>,
    attribute_position: JsVal,
    start: usize,
    end: usize,
) -> JsVal {
    obj! {
        "type" => node_type(kind),
        "name" => JsVal::array(name),
        "value" => JsVal::array(value),
        "attributePosition" => attribute_position,
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_attr_double_quoted(
    name: Vec<JsVal>,
    value: Vec<JsVal>,
    attribute_position: JsVal,
    start: usize,
    end: usize,
) -> JsVal {
    make_attr_with_value(
        NodeTypes::AttrDoubleQuoted,
        name,
        value,
        attribute_position,
        start,
        end,
    )
}

pub fn make_attr_single_quoted(
    name: Vec<JsVal>,
    value: Vec<JsVal>,
    attribute_position: JsVal,
    start: usize,
    end: usize,
) -> JsVal {
    make_attr_with_value(
        NodeTypes::AttrSingleQuoted,
        name,
        value,
        attribute_position,
        start,
        end,
    )
}

pub fn make_attr_unquoted(
    name: Vec<JsVal>,
    value: Vec<JsVal>,
    attribute_position: JsVal,
    start: usize,
    end: usize,
) -> JsVal {
    make_attr_with_value(
        NodeTypes::AttrUnquoted,
        name,
        value,
        attribute_position,
        start,
        end,
    )
}

pub fn make_attr_empty(name: Vec<JsVal>, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::AttrEmpty),
        "name" => JsVal::array(name),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}

pub fn make_html_dangling_marker_close(name: Vec<JsVal>, start: usize, end: usize) -> JsVal {
    obj! {
        "type" => node_type(NodeTypes::HtmlDanglingMarkerClose),
        "name" => JsVal::array(name),
        "blockStartPosition" => JsVal::position(start, end),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
    }
}
