//! Port of `document/html.ts` (strict paths).

use std::borrow::Cow;

use liquid_ast::*;

use crate::markup::PResult;
use crate::parser::{
    compound_names_match, error, filter_children, slice, text_node, FilterMode, Parser,
};
use crate::tokenizer::{Token, TokenType as TT};
use crate::{first_word, is_js_space, js_lower_eq, js_trim, starts_with_js_space, ParseError};

const VOID_ELEMENTS: &[&str] = &[
    "area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link",
    "meta", "param", "source", "track", "wbr",
];
const HTML_RAW_TAGS: &[&str] = &["script", "style", "svg"];
const BLOCKS: &[&str] = &[
    "if",
    "unless",
    "for",
    "case",
    "tablerow",
    "capture",
    "form",
    "paginate",
    "block",
    "ifchanged",
    "partial",
];

/// `extractPlainName`
fn plain_name<'n, 'a>(name: &'n [Node<'a>]) -> Option<&'n str> {
    match name {
        [Node::TextNode(t)] => Some(&t.value),
        _ => None,
    }
}

/// `plainName || 'compound'`
fn display_name(name: Option<&str>) -> &str {
    match name {
        Some(n) if !n.is_empty() => n,
        _ => "compound",
    }
}

fn is_raw_or_void(name: &str, list: &[&'static str]) -> bool {
    list.iter().any(|n| js_lower_eq(name, n))
}

/// `rawMarkupKindForHtmlTag`
fn raw_markup_kind_for_html_tag(lower_name: &str, attributes: &[Node], body: &str) -> &'static str {
    match lower_name {
        "script" => match plain_attribute_value(attributes, "type") {
            None => "javascript",
            Some("text/html") => "html",
            Some("text/markdown") => "markdown",
            Some(t)
                if t.ends_with("json") || t.ends_with("importmap") || t == "speculationrules" =>
            {
                "json"
            }
            Some(_) => "javascript",
        },
        "style" if crate::has_liquid_open(body) => "text",
        "style" => "css",
        _ => "text",
    }
}

/// `extractPlainAttributeValue`
fn plain_attribute_value<'n>(attributes: &'n [Node], target: &str) -> Option<&'n str> {
    for attr in attributes {
        let (Node::AttrDoubleQuoted(a) | Node::AttrSingleQuoted(a) | Node::AttrUnquoted(a)) = attr
        else {
            continue;
        };
        match plain_name(&a.name) {
            Some(n) if js_lower_eq(n, target) => {}
            _ => continue,
        }
        return match a.value.as_slice() {
            [Node::TextNode(t)] => Some(&t.value),
            _ => None,
        };
    }
    None
}

impl<'a> Parser<'a> {
    pub(crate) fn parse_html_element(&mut self) -> PResult<Node<'a>> {
        let source = self.source;
        let open_start = self.peek().start;
        self.consume(TT::HtmlTagOpen)?;
        let name = self.parse_compound_name()?;
        let attributes = self.parse_attributes()?;
        if self.accept(TT::HtmlSelfClose).is_some() {
            let bsp = Position::new(open_start, self.tokens[self.p - 1].end);
            return Ok(Node::HtmlSelfClosingElement(HtmlSelfClosingElement {
                name,
                attributes,
                block_start_position: bsp,
                position: bsp,
            }));
        }
        self.consume(TT::HtmlTagClose)?;
        let open_end = self.tokens[self.p - 1].end;
        let bsp = Position::new(open_start, open_end);
        let plain = plain_name(&name);
        if let Some(plain) = plain {
            if is_raw_or_void(plain, VOID_ELEMENTS) {
                let name = match name.into_iter().next() {
                    Some(Node::TextNode(t)) => t.value,
                    _ => unreachable!(),
                };
                return Ok(Node::HtmlVoidElement(HtmlVoidElement {
                    name,
                    attributes,
                    block_start_position: bsp,
                    position: bsp,
                }));
            }
            if is_raw_or_void(plain, HTML_RAW_TAGS) {
                let name = match name.into_iter().next() {
                    Some(Node::TextNode(t)) => t.value,
                    _ => unreachable!(),
                };
                return Ok(Node::HtmlRawNode(
                    self.parse_html_raw_body(name, attributes, bsp)?,
                ));
            }
        }

        let mut children = Vec::new();
        while !self.is_at_end() {
            if self.check(TT::HtmlCloseTagOpen, 0) {
                break;
            }
            if self.is_block_terminator() {
                if !self.allow_unclosed_html {
                    let tag_name = self.peek_tag_name().unwrap();
                    return Err(error(
                        format!(
                            "Attempting to close LiquidTag '{tag_name}' before HtmlElement '{}' was closed",
                            display_name(plain_name(&name))
                        ),
                        open_start,
                        open_end,
                    ));
                }
                break;
            }
            children.push(self.nested(Self::parse_node)?);
        }

        if self.is_at_end() || (self.allow_unclosed_html && self.is_block_terminator()) {
            if !self.allow_unclosed_html {
                return Err(error(
                    format!(
                        "Attempting to end parsing before HtmlElement '{}' was closed",
                        display_name(plain_name(&name))
                    ),
                    open_start,
                    open_end,
                ));
            }
            let end = children.last().map_or(open_end, |c| c.position().end);
            return Ok(Node::HtmlElement(HtmlElement {
                name,
                attributes,
                children: filter_children(source, FilterMode::Syntactic, children),
                block_start_position: bsp,
                block_end_position: Position::new(end, end),
                position: Position::new(open_start, end),
            }));
        }

        let close_start = self.peek().start;
        self.consume(TT::HtmlCloseTagOpen)?;
        let close_name = self.parse_compound_name()?;
        self.skip_blank_text();
        self.consume(TT::HtmlTagClose)?;
        let close_end = self.tokens[self.p - 1].end;
        if !compound_names_match(source, &name, &close_name) {
            return Err(error(
                format!(
                    "Attempting to close HtmlElement '{}' before HtmlElement '{}' was closed",
                    display_name(plain_name(&close_name)),
                    display_name(plain_name(&name))
                ),
                close_start,
                close_end,
            ));
        }
        Ok(Node::HtmlElement(HtmlElement {
            name,
            attributes,
            children: filter_children(source, FilterMode::Syntactic, children),
            block_start_position: bsp,
            block_end_position: Position::new(close_start, close_end),
            position: Position::new(open_start, close_end),
        }))
    }

    /// Skips Text tokens matching `/^\s*$/`.
    fn skip_blank_text(&mut self) {
        while self.check(TT::Text, 0) {
            let t = self.peek();
            if !self.source[t.start..t.end].chars().all(is_js_space) {
                break;
            }
            self.p += 1;
        }
    }

    fn parse_html_raw_body(
        &mut self,
        name: Str<'a>,
        attributes: Vec<Node<'a>>,
        bsp: Position,
    ) -> PResult<HtmlRawNode<'a>> {
        let source = self.source;
        let lower = name.to_lowercase();
        let Some(close_idx) = self.scan_for_html_close_tag(&lower) else {
            return Err(error(
                format!("Attempting to end parsing before HtmlRawNode '{name}' was closed"),
                bsp.start,
                bsp.end,
            ));
        };
        let (body_start, body_end) = (bsp.end, self.tokens[close_idx].start);
        let body = slice(source, body_start, body_end);
        let nodes = self.parse_liquid_in_range(body_end)?;
        let kind = raw_markup_kind_for_html_tag(&lower, &attributes, body);
        let raw = RawMarkup {
            kind,
            value: Cow::Borrowed(body),
            nodes,
            position: Position::new(body_start, body_end),
        };
        self.seek_to_source_offset(body_end);
        let close_start = self.peek().start;
        self.consume(TT::HtmlCloseTagOpen)?;
        while self.check(TT::Text, 0) {
            self.p += 1;
        }
        let close_end = self.consume(TT::HtmlTagClose)?.end;
        Ok(HtmlRawNode {
            name,
            attributes,
            body: raw,
            block_start_position: bsp,
            block_end_position: Position::new(close_start, close_end),
            position: Position::new(bsp.start, close_end),
        })
    }

    /// `scanForHtmlCloseTag`: index of the matching close tag's `</` token.
    fn scan_for_html_close_tag(&self, lower: &str) -> Option<usize> {
        let (source, tokens) = (self.source, &self.tokens);
        let mut depth = 0usize;
        for i in self.p..tokens.len() {
            let t = tokens[i];
            if t.kind == TT::HtmlTagOpen {
                if let Some(text) = tokens.get(i + 1).filter(|n| n.kind == TT::Text) {
                    if js_lower_eq(first_word(&source[text.start..text.end]), lower) {
                        depth += 1;
                    }
                }
                continue;
            }
            if t.kind != TT::HtmlCloseTagOpen {
                continue;
            }
            let texts = tokens[i + 1..]
                .iter()
                .take_while(|n| n.kind == TT::Text)
                .count();
            if texts == 0 {
                continue;
            }
            let text = &source[t.end..tokens[i + texts].end];
            if js_lower_eq(js_trim(text), lower) {
                if depth == 0 {
                    return Some(i);
                }
                depth -= 1;
            }
        }
        None
    }

    pub(crate) fn parse_html_comment(&mut self) -> PResult<HtmlComment<'a>> {
        let open = self.consume(TT::HtmlCommentOpen)?;
        let Some(close) = crate::find_ascii(&self.source[open.end..], "-->").map(|i| i + open.end)
        else {
            return Err(error(
                "Attempting to end parsing before HtmlComment '<!--' was closed".into(),
                open.start,
                open.end,
            ));
        };
        let body = js_trim(&self.source[open.end..close]);
        self.seek_to_source_offset(close + 3);
        Ok(HtmlComment {
            body: Cow::Borrowed(body),
            position: Position::new(open.start, close + 3),
        })
    }

    pub(crate) fn parse_html_doctype(&mut self) -> PResult<HtmlDoctype<'a>> {
        let open = self.consume(TT::HtmlDoctypeOpen)?;
        while !self.is_at_end() && !self.check(TT::HtmlTagClose, 0) {
            self.p += 1;
        }
        let close = self.consume(TT::HtmlTagClose)?;
        let body = js_trim(&self.source[open.end..close.start]);
        let legacy = match legacy_doctype(body) {
            Some("") => None,
            Some(rest) => Some(rest),
            None => Some(body),
        };
        Ok(HtmlDoctype {
            legacy_doctype_string: legacy.map(Cow::Borrowed),
            position: Position::new(open.start, close.end),
        })
    }

    pub(crate) fn parse_orphaned_html_close_tag(&mut self) -> ParseError {
        let close_start = self.peek().start;
        let close_name = match self.parse_close_tag_rest() {
            Ok(n) => n,
            Err(e) => return e,
        };
        let close_end = self.tokens[self.p - 1].end;
        error(
            format!(
                "Attempting to close HtmlElement '{}' before it was opened",
                display_name(plain_name(&close_name))
            ),
            close_start,
            close_end,
        )
    }

    pub(crate) fn parse_html_dangling_marker_close(
        &mut self,
    ) -> PResult<HtmlDanglingMarkerClose<'a>> {
        let start = self.peek().start;
        let name = self.parse_close_tag_rest()?;
        let position = Position::new(start, self.tokens[self.p - 1].end);
        Ok(HtmlDanglingMarkerClose {
            name,
            block_start_position: position,
            position,
        })
    }

    /// `</` name blank-text* `>`
    fn parse_close_tag_rest(&mut self) -> PResult<Vec<Node<'a>>> {
        self.consume(TT::HtmlCloseTagOpen)?;
        let name = self.parse_compound_name()?;
        self.skip_blank_text();
        self.consume(TT::HtmlTagClose)?;
        Ok(name)
    }

    pub(crate) fn parse_branch_attributes(&mut self) -> PResult<Vec<Node<'a>>> {
        self.parse_attribute_list(true)
    }

    fn parse_attributes(&mut self) -> PResult<Vec<Node<'a>>> {
        let saved = self.in_attribute_context;
        self.in_attribute_context = true;
        let result = self.parse_attribute_list(false);
        self.in_attribute_context = saved;
        result
    }

    /// `parseAttributeList`, or `parseBranchAttributesImpl` when `in_branch`.
    fn parse_attribute_list(&mut self, in_branch: bool) -> PResult<Vec<Node<'a>>> {
        let mut attrs = Vec::new();
        while !self.is_at_end() {
            self.skip_space();
            if self.is_at_end()
                || self.check(TT::HtmlTagClose, 0)
                || self.check(TT::HtmlSelfClose, 0)
            {
                break;
            }
            if in_branch && self.is_block_terminator() {
                break;
            }
            if self.check(TT::LiquidTagOpen, 0) {
                let saved = self.in_attribute_context;
                self.in_attribute_context = true;
                let tag = self.parse_liquid_tag();
                self.in_attribute_context = saved;
                attrs.push(tag?);
                continue;
            }
            if self.check(TT::LiquidVariableOutputOpen, 0) {
                attrs.push(Node::LiquidVariableOutput(
                    self.parse_liquid_variable_output()?,
                ));
                continue;
            }
            let attr_start = self.peek().start;
            let name = self.parse_compound_name()?;
            if name.is_empty() {
                self.p += 1;
                continue;
            }
            attrs.push(self.parse_attribute_after_name(name, attr_start)?);
        }
        Ok(attrs)
    }

    fn parse_attribute_after_name(
        &mut self,
        name: Vec<Node<'a>>,
        attr_start: usize,
    ) -> PResult<Node<'a>> {
        self.skip_space();
        if self.accept(TT::HtmlEquals).is_none() {
            let end = name.last().unwrap().position().end;
            return Ok(Node::AttrEmpty(AttrEmpty {
                name,
                position: Position::new(attr_start, end),
            }));
        }
        self.skip_space();
        let Some(quote) = self.accept(TT::HtmlQuoteOpen) else {
            let mut value = Vec::new();
            let mut end = self.peek().start;
            while !self.is_at_end() {
                if self.check(TT::HtmlTagClose, 0) || self.check(TT::HtmlSelfClose, 0) {
                    break;
                }
                if let Some(seg) = self.consume_text_segment() {
                    end = seg.position().end;
                    value.push(seg);
                    continue;
                }
                if self.check(TT::LiquidVariableOutputOpen, 0) {
                    let drop = self.parse_liquid_variable_output()?;
                    end = drop.position.end;
                    value.push(Node::LiquidVariableOutput(drop));
                    continue;
                }
                break;
            }
            let start = value
                .first()
                .map_or(self.peek().start, |v| v.position().start);
            let attr = Attr {
                name,
                value,
                attribute_position: Position::new(start, end),
                position: Position::new(attr_start, end),
            };
            return Ok(Node::AttrUnquoted(attr));
        };
        let value = self.parse_quoted_attribute_value()?;
        let close = self.consume(TT::HtmlQuoteClose)?;
        let attr = Attr {
            name,
            value,
            attribute_position: Position::new(quote.end, close.start),
            position: Position::new(attr_start, close.end),
        };
        Ok(match self.source[quote.start..].chars().next() {
            Some('"' | '“' | '”') => Node::AttrDoubleQuoted(attr),
            _ => Node::AttrSingleQuoted(attr),
        })
    }

    fn is_space_token(&self, t: Token) -> bool {
        starts_with_js_space(&self.source[t.start..t.end])
    }

    fn skip_space(&mut self) {
        while self.check(TT::Text, 0) && self.is_space_token(self.peek()) {
            self.p += 1;
        }
    }

    fn parse_quoted_attribute_value(&mut self) -> PResult<Vec<Node<'a>>> {
        let mut values = Vec::new();
        while !self.is_at_end() && !self.check(TT::HtmlQuoteClose, 0) {
            let t = self.peek();
            match t.kind {
                TT::LiquidVariableOutputOpen => values.push(Node::LiquidVariableOutput(
                    self.parse_liquid_variable_output()?,
                )),
                TT::LiquidTagOpen => {
                    let tag_name = self.peek_tag_name().unwrap();
                    if matches!(tag_name, "else" | "elsif" | "when") || tag_name.starts_with("end")
                    {
                        return Err(error(
                            format!(
                                "Unexpected Liquid tag '{tag_name}' inside quoted attribute value"
                            ),
                            t.start,
                            t.end,
                        ));
                    }
                    let saved = self.in_attribute_value_context;
                    self.in_attribute_value_context = true;
                    let tag = self.parse_liquid_tag();
                    self.in_attribute_value_context = saved;
                    values.push(tag?);
                }
                TT::Text => {
                    self.p += 1;
                    values.push(text_node(self.source, t.start, t.end));
                }
                _ => break,
            }
        }
        Ok(values)
    }

    fn consume_text_segment(&mut self) -> Option<Node<'a>> {
        if !self.check(TT::Text, 0) {
            return None;
        }
        let t = self.peek();
        if self.is_space_token(t) {
            return None;
        }
        self.p += 1;
        Some(text_node(self.source, t.start, t.end))
    }

    pub(crate) fn parse_compound_name(&mut self) -> PResult<Vec<Node<'a>>> {
        let mut segments: Vec<Node<'a>> = Vec::new();
        while !self.is_at_end() {
            if self.check(TT::LiquidVariableOutputOpen, 0) {
                segments.push(Node::LiquidVariableOutput(
                    self.parse_liquid_variable_output()?,
                ));
                continue;
            }
            if !self.in_attribute_context
                && self.check(TT::LiquidTagOpen, 0)
                && !segments
                    .iter()
                    .any(|s| matches!(s, Node::LiquidVariableOutput(_)))
                && !self.liquid_tag_starts_attribute_list(&segments)
            {
                segments.push(self.parse_liquid_tag()?);
                continue;
            }
            match self.consume_text_segment() {
                Some(seg) => segments.push(seg),
                None => break,
            }
        }
        Ok(segments)
    }

    fn liquid_tag_starts_attribute_list(&self, segments: &[Node<'a>]) -> bool {
        if !segments.iter().any(|s| matches!(s, Node::TextNode(_))) {
            return false;
        }
        match self.peek_tag_name() {
            Some(name) if BLOCKS.contains(&name) => self.liquid_tag_body_starts_with_whitespace(),
            _ => false,
        }
    }

    fn liquid_tag_body_starts_with_whitespace(&self) -> bool {
        let (source, tokens) = (self.source, &self.tokens);
        let (mut in_tag, mut trim_next) = (false, false);
        for i in self.p..tokens.len() {
            let t = tokens[i];
            match t.kind {
                TT::LiquidTagOpen => in_tag = true,
                TT::LiquidTagClose => {
                    in_tag = false;
                    trim_next = t.len() == 3;
                }
                TT::Text if !in_tag => {
                    let mut text = &source[t.start..t.end];
                    if trim_next {
                        text = text.trim_start_matches(is_js_space);
                    }
                    trim_next = false;
                    if text.is_empty() {
                        continue;
                    }
                    let left_trimming_next = tokens.get(i + 1).is_some_and(|n| {
                        matches!(n.kind, TT::LiquidVariableOutputOpen | TT::LiquidTagOpen)
                            && n.len() == 3
                    });
                    if text.chars().all(is_js_space) && left_trimming_next {
                        continue;
                    }
                    return starts_with_js_space(text);
                }
                TT::LiquidVariableOutputOpen
                | TT::HtmlTagClose
                | TT::HtmlSelfClose
                | TT::EndOfInput
                    if !in_tag =>
                {
                    return false
                }
                _ => {}
            }
        }
        false
    }
}

/// `/^doctype\s+html\s*(.*)/i` on the trimmed body: `Some(group 1)` on a match.
fn legacy_doctype(body: &str) -> Option<&str> {
    let b = body.as_bytes();
    if b.len() < 7 || !b[..7].eq_ignore_ascii_case(b"doctype") {
        return None;
    }
    let rest = &body[7..];
    let after_space = rest.trim_start_matches(is_js_space);
    if after_space.len() == rest.len()
        || after_space.len() < 4
        || !after_space.as_bytes()[..4].eq_ignore_ascii_case(b"html")
    {
        return None;
    }
    let tail = after_space[4..].trim_start_matches(is_js_space);
    let line_end = tail
        .find(['\n', '\r', '\u{2028}', '\u{2029}'])
        .unwrap_or(tail.len());
    Some(&tail[..line_end])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_doctype_matches_ts_regex() {
        assert_eq!(legacy_doctype("DOCTYPE html"), Some(""));
        assert_eq!(
            legacy_doctype("doctype  HTML\n PUBLIC \"x\"\nmore"),
            Some("PUBLIC \"x\"")
        );
        assert_eq!(legacy_doctype("doctypehtml"), None);
        assert_eq!(legacy_doctype("doctype html5"), Some("5"));
    }
}
