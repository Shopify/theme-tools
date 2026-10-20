//! Port of `tags/*.ts` and the default `Environment.tagForName`.

use liquid_ast::*;

use crate::markup::{MarkupParser, MarkupTokenType as T, PResult};
use crate::ParseError;

/// Keys of TS `builtinTags`, in declaration order.
pub const BUILTIN_TAGS: &[&str] = &[
    "assign",
    "block",
    "break",
    "capture",
    "case",
    "content_for",
    "continue",
    "cycle",
    "decrement",
    "echo",
    "for",
    "form",
    "if",
    "ifchanged",
    "include",
    "increment",
    "layout",
    "liquid",
    "paginate",
    "partial",
    "render",
    "section",
    "sections",
    "tablerow",
    "unless",
    "comment",
    "doc",
    "javascript",
    "raw",
    "schema",
    "style",
    "stylesheet",
];

pub const LOOP_NAMED_TAGS: &[&str] = &["for", "tablerow"];

/// `Object.prototype` property names. `builtinTags` and `LiquidLiteralValues` are plain object
/// literals, so JS lookups (`obj[name]`, `name in obj`) find these too.
pub(crate) const PROTO_NAMES: &[&str] = &[
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

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum TagKind {
    Block,
    Tag,
    Raw,
    /// A truthy `builtinTags[name]` that is an `Object.prototype` member (no `kind`).
    Proto,
}

pub(crate) fn tag_for_name(name: &str) -> Option<TagKind> {
    Some(match name {
        "if" | "unless" | "case" | "for" | "tablerow" | "capture" | "block" | "paginate"
        | "form" | "ifchanged" | "partial" => TagKind::Block,
        "assign" | "break" | "content_for" | "continue" | "cycle" | "decrement" | "echo"
        | "include" | "increment" | "layout" | "liquid" | "render" | "section" | "sections" => {
            TagKind::Tag
        }
        "comment" | "doc" | "javascript" | "raw" | "schema" | "style" | "stylesheet" => {
            TagKind::Raw
        }
        _ if PROTO_NAMES.contains(&name) => TagKind::Proto,
        _ => return None,
    })
}

/// `def.branches` of a block tag (empty for anything else).
pub(crate) fn branches(name: &str) -> &'static [&'static str] {
    match name {
        "if" | "unless" => &["elsif", "else"],
        "case" => &["when", "else"],
        "for" | "tablerow" => &["else"],
        _ => &[],
    }
}

pub(crate) fn is_branch_name(name: &str) -> bool {
    matches!(name, "elsif" | "else" | "when")
}

/// `assertNever(def)` on a definition without `kind`.
pub(crate) fn proto_error() -> ParseError {
    ParseError::plain("Unexpected object: undefined".into())
}

fn err<X>(message: String) -> PResult<X> {
    Err(ParseError::plain(message))
}

fn node(n: Node<'_>) -> Markup<'_> {
    Markup::Node(Box::new(n))
}

fn expect_string<'a>(n: Node<'a>, what: &str) -> PResult<LiquidString<'a>> {
    match n {
        Node::String(s) => Ok(s),
        n => err(format!("Expected string for {what}, got {}", n.type_name())),
    }
}

/// `def.parse(name, markup, parser)` for Block/Tag tags other than `liquid`.
pub(crate) fn parse_markup<'a>(name: &str, m: &mut MarkupParser<'a>) -> PResult<Markup<'a>> {
    Ok(match name {
        "if" | "unless" => node(m.conditional_expression()?),
        "case" | "layout" => node(m.value_expression()?),
        "for" | "tablerow" => node(Node::ForMarkup(parse_for(m)?)),
        "capture" | "decrement" | "increment" => node(Node::VariableLookup(m.variable_lookup()?)),
        "block" => node(Node::BlockMarkup(parse_block(m)?)),
        "paginate" => node(Node::PaginateMarkup(parse_paginate(m)?)),
        "form" => Markup::Nodes(m.arguments()?),
        "ifchanged" => Markup::Null,
        "partial" => node(Node::String(expect_string(
            m.value_expression()?,
            "partial name",
        )?)),
        "assign" => node(Node::AssignMarkup(parse_assign(m)?)),
        "break" | "continue" => {
            if !m.is_at_end() {
                return err(format!("'{name}' tag does not accept markup"));
            }
            Markup::Str("".into())
        }
        "content_for" => node(Node::ContentForMarkup(parse_content_for(m)?)),
        "cycle" => node(Node::CycleMarkup(parse_cycle(m)?)),
        "echo" => node(Node::LiquidVariable(m.liquid_variable()?)),
        "render" | "include" => node(Node::RenderMarkup(parse_render(m, name == "include")?)),
        "sections" => node(Node::String(expect_string(
            m.value_expression()?,
            "sections name",
        )?)),
        "section" => node(Node::SectionMarkup(parse_section(m)?)),
        _ => unreachable!("no markup parser for {name}"),
    })
}

/// `whenBranchParse`
pub(crate) fn parse_when<'a>(m: &mut MarkupParser<'a>) -> PResult<Vec<Node<'a>>> {
    let mut values = vec![m.value_expression()?];
    loop {
        if m.consume_optional(T::Comma).is_some() {
            values.push(m.value_expression()?);
            continue;
        }
        let t = m.peek();
        if t.kind == T::Logical && t.value == "or" {
            m.consume(T::Logical)?;
            values.push(m.value_expression()?);
            continue;
        }
        break;
    }
    let colon = m.peek();
    if colon.kind == T::Colon
        && m.look(T::EndOfString, 1)
        && matches!(values.last(), Some(Node::String(s)) if s.position.end == colon.start)
    {
        m.consume(T::Colon)?;
    }
    Ok(values)
}

fn parse_assign<'a>(m: &mut MarkupParser<'a>) -> PResult<AssignMarkup<'a>> {
    let start = m.peek().start;
    let name = m.consume(T::Id)?.value;
    if m.consume(T::Equality)?.value != "=" {
        return err("Expected '=' in assign tag".into());
    }
    let value = m.liquid_variable()?;
    Ok(AssignMarkup {
        name: name.into(),
        value,
        position: Position::new(start, m.peek().start),
    })
}

/// `/^_?[a-zA-Z0-9][\w-]*$/`
fn is_block_type(s: &str) -> bool {
    let b = s.strip_prefix('_').unwrap_or(s).as_bytes();
    !b.is_empty()
        && b[0].is_ascii_alphanumeric()
        && b[1..]
            .iter()
            .all(|c| c.is_ascii_alphanumeric() || *c == b'_' || *c == b'-')
}

fn parse_block<'a>(m: &mut MarkupParser<'a>) -> PResult<BlockMarkup<'a>> {
    if m.is_at_end() {
        return err("in 'block' - missing block type".into());
    }
    let Node::String(name) = m.value_expression()? else {
        return err("in 'block' - file name must be a string literal".into());
    };
    if !is_block_type(&name.value) {
        return err(format!(
            "in 'block' - '{}' is not a valid block type",
            name.value
        ));
    }
    let mut args = Vec::new();
    if m.consume_optional(T::Comma).is_some() && !m.is_at_end() {
        args = m.block_named_arguments()?;
    }
    if !m.is_at_end() {
        return err(format!(
            "Unexpected token in 'block' tag: {}",
            m.peek().value
        ));
    }
    let position = Position::new(name.position.start, m.peek().start);
    Ok(BlockMarkup {
        name,
        args,
        position,
    })
}

fn parse_content_for<'a>(m: &mut MarkupParser<'a>) -> PResult<ContentForMarkup<'a>> {
    let content_for_type = expect_string(m.value_expression()?, "content_for type")?;
    let mut args = Vec::new();
    m.consume_optional(T::Comma);
    while m.look(T::Id, 0) {
        match m.named_argument() {
            Ok(a) => args.push(a),
            Err(_) => break,
        }
        m.consume_optional(T::Comma);
    }
    let position = Position::new(content_for_type.position.start, m.peek().start);
    Ok(ContentForMarkup {
        content_for_type,
        args,
        position,
    })
}

fn parse_cycle<'a>(m: &mut MarkupParser<'a>) -> PResult<CycleMarkup<'a>> {
    let first = m.value_expression()?;
    let start = first.position().start;
    let mut group_name = None;
    let mut args = Vec::new();
    if m.consume_optional(T::Colon).is_some() {
        group_name = Some(Box::new(first));
        args.push(m.value_expression()?);
    } else {
        args.push(first);
    }
    while m.consume_optional(T::Comma).is_some() {
        args.push(m.value_expression()?);
    }
    Ok(CycleMarkup {
        group_name,
        args,
        position: Position::new(start, m.peek().start),
    })
}

fn parse_for<'a>(m: &mut MarkupParser<'a>) -> PResult<ForMarkup<'a>> {
    let name = m.consume(T::Id)?;
    if !m.id("in") {
        return err("Expected 'in'".into());
    }
    let collection = m.value_expression()?;
    let reversed = m.id("reversed");
    let mut args = Vec::new();
    while !m.is_at_end() {
        m.consume_optional(T::Comma);
        args.push(m.named_argument()?);
    }
    Ok(ForMarkup {
        variable_name: name.value.into(),
        collection: Box::new(collection),
        reversed,
        args,
        position: Position::new(name.start, m.peek().start),
    })
}

fn parse_paginate<'a>(m: &mut MarkupParser<'a>) -> PResult<PaginateMarkup<'a>> {
    let collection = m.value_expression()?;
    if !m.id("by") {
        return err("Expected 'by' in paginate tag".into());
    }
    let page_size = m.value_expression()?;
    let mut args = Vec::new();
    if m.consume_optional(T::Comma).is_some() {
        args = m.named_arguments()?;
    }
    let position = Position::new(collection.position().start, m.peek().start);
    Ok(PaginateMarkup {
        collection: Box::new(collection),
        page_size: Box::new(page_size),
        args,
        position,
    })
}

fn parse_render<'a>(
    m: &mut MarkupParser<'a>,
    allow_any_template_name: bool,
) -> PResult<RenderMarkup<'a>> {
    let snippet = m.value_expression()?;
    if !allow_any_template_name && !matches!(snippet, Node::String(_) | Node::VariableLookup(_)) {
        return err(format!(
            "Expected string or variable lookup for snippet, got {}",
            snippet.type_name()
        ));
    }
    let kw_start = m.peek().start;
    let kind = if m.id("for") {
        Some("for")
    } else if m.id("with") {
        Some("with")
    } else {
        None
    };
    let mut variable = None;
    if let Some(kind) = kind {
        let name = m.value_expression()?;
        let position = Position::new(kw_start, name.position().end);
        variable = Some(RenderVariableExpression {
            kind,
            name: Box::new(name),
            position,
        });
    }
    let as_start = m.peek().start;
    let mut alias = None;
    if m.id("as") {
        let a = m.consume(T::Id)?;
        alias = Some(RenderAliasExpression {
            value: a.value.into(),
            position: Position::new(as_start, a.end),
        });
    }
    let mut args = Vec::new();
    m.consume_optional(T::Comma);
    while m.look(T::Id, 0) && m.look(T::Colon, 1) {
        args.push(m.named_argument()?);
        m.consume_optional(T::Comma);
    }
    let position = Position::new(snippet.position().start, m.peek().start);
    Ok(RenderMarkup {
        snippet: Box::new(snippet),
        variable,
        alias,
        args,
        position,
    })
}

fn parse_section<'a>(m: &mut MarkupParser<'a>) -> PResult<BlockMarkup<'a>> {
    let name = expect_string(m.value_expression()?, "section name")?;
    let mut args = Vec::new();
    if m.consume_optional(T::Comma).is_some() {
        args = m.block_named_arguments()?;
    }
    let position = Position::new(name.position.start, m.peek().start);
    Ok(BlockMarkup {
        name,
        args,
        position,
    })
}
