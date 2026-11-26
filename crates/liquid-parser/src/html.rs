//! Port of `document/html.ts` (strict paths).

use std::borrow::Cow;

use liquid_ast::*;

use crate::markup::PResult;
use crate::parser::{
    compound_names_match, error, filter_children, slice, text_node, FilterMode, Parser,
};
use crate::raw_body::{find_raw_body_end, liquid_tag_token_name, rule_for};
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

/// The element name as written, Liquid included: `h{{ level }}` for `<h{{ level }}>`.
fn name_source<'s>(source: &'s str, name: &[Node]) -> &'s str {
    match (name.first(), name.last()) {
        (Some(first), Some(last)) => slice(source, first.span().start, last.span().end),
        _ => "",
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
            let bsp = Span::new(open_start, self.tokens[self.p - 1].end);
            return Ok(Node::HtmlSelfClosingElement(HtmlSelfClosingElement {
                name,
                attributes,
                start_tag: bsp,
                span: bsp,
            }));
        }
        self.consume(TT::HtmlTagClose)?;
        let open_end = self.tokens[self.p - 1].end;
        let bsp = Span::new(open_start, open_end);
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
                    start_tag: bsp,
                    span: bsp,
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
                    )
                    .unclosed("HtmlElement", name_source(source, &name), bsp));
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
                )
                .unclosed("HtmlElement", name_source(source, &name), bsp));
            }
            let end = children.last().map_or(open_end, |c| c.span().end);
            return Ok(Node::HtmlElement(HtmlElement {
                name,
                attributes,
                children: filter_children(source, FilterMode::Syntactic, children),
                start_tag: bsp,
                end_tag: Span::new(end, end),
                span: Span::new(open_start, end),
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
            )
            .unclosed("HtmlElement", name_source(source, &name), bsp));
        }
        Ok(Node::HtmlElement(HtmlElement {
            name,
            attributes,
            children: filter_children(source, FilterMode::Syntactic, children),
            start_tag: bsp,
            end_tag: Span::new(close_start, close_end),
            span: Span::new(open_start, close_end),
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
        bsp: Span,
    ) -> PResult<HtmlRawNode<'a>> {
        let source = self.source;
        let lower = name.to_lowercase();
        let body_start = bsp.end;
        let body_end = match self.scan_for_html_close_tag(&lower) {
            Some(i) => self.tokens[i].start,
            // The tokens missed the close tag of a `<script>` or `<style>`: read it from the source.
            None => {
                let raw_text = (lower != "svg")
                    .then(|| find_raw_text_close(source, body_start, &lower))
                    .flatten();
                let Some((start, end)) = raw_text else {
                    return Err(error(
                        format!("Attempting to end parsing before HtmlRawNode '{name}' was closed"),
                        bsp.start,
                        bsp.end,
                    )
                    .unclosed("HtmlRawNode", &name, bsp));
                };
                self.retokenize_raw_text(body_start, start, end);
                start
            }
        };
        let body = slice(source, body_start, body_end);
        let nodes = self.parse_liquid_in_range(body_end)?;
        let kind = raw_markup_kind_for_html_tag(&lower, &attributes, body);
        let raw = RawMarkup {
            kind,
            value: Cow::Borrowed(body),
            nodes,
            span: Span::new(body_start, body_end),
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
            start_tag: bsp,
            end_tag: Span::new(close_start, close_end),
            span: Span::new(bsp.start, close_end),
        })
    }

    /// `scanForHtmlCloseTag`: index of the matching close tag's `</` token.
    fn scan_for_html_close_tag(&mut self, lower: &str) -> Option<usize> {
        let source = self.source;
        let mut depth = 0usize;
        for i in self.p.. {
            if !self.has_token(i) {
                break;
            }
            let t = self.tokens[i];
            if t.kind == TT::HtmlTagOpen {
                if self.kind_at(i + 1) == Some(TT::Text) {
                    let text = self.tokens[i + 1];
                    if js_lower_eq(first_word(&source[text.start..text.end]), lower) {
                        depth += 1;
                    }
                }
                continue;
            }
            if t.kind != TT::HtmlCloseTagOpen {
                continue;
            }
            let mut end = i + 1;
            while self.kind_at(end) == Some(TT::Text) {
                end += 1;
            }
            if end == i + 1 {
                continue;
            }
            let text = &source[t.end..self.tokens[end - 1].end];
            if js_lower_eq(js_trim(text), lower) {
                if depth == 0 {
                    return Some(i);
                }
                depth -= 1;
            }
        }
        None
    }

    /// `parseHtmlComment`: the body is text and Liquid, never markup. At a tag that ends or
    /// branches an enclosing block, the comment stops before it and `parse_node` resumes it after
    /// that tag. A block opened inside the comment that consumes the `-->` ends it.
    pub(crate) fn parse_html_comment(&mut self) -> PResult<HtmlComment<'a>> {
        let source = self.source;
        let start = self.peek().start;
        let mut bsp = Span::new(start, start);
        if let Some(open) = self.accept(TT::HtmlCommentOpen) {
            bsp = Span::new(open.start, open.end);
            self.open_html_comment = Some(bsp);
        }
        let (mut children, mut bep) = (Vec::new(), None);
        let saved = self.parse_html;
        self.parse_html = false;
        while self.open_html_comment.is_some() {
            // A browser ends an unclosed comment at the end of the input.
            if self.is_at_end() {
                self.open_html_comment = None;
                break;
            }
            if let Some(close) = self.accept(TT::HtmlCommentClose) {
                bep = Some(Span::new(close.start, close.end));
                self.open_html_comment = None;
                break;
            }
            if self.is_block_terminator() {
                break;
            }
            children.push(self.parse_node()?);
        }
        self.parse_html = saved;
        let end = self.peek().start;
        let bep = bep.unwrap_or(Span::new(end, end));
        Ok(HtmlComment {
            body: Cow::Borrowed(js_trim(slice(source, bsp.end, bep.start))),
            children: filter_children(source, FilterMode::Syntactic, children),
            start_tag: bsp,
            end_tag: bep,
            span: Span::new(bsp.start, bep.end),
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
            span: Span::new(open.start, close.end),
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
        let span = Span::new(start, self.tokens[self.p - 1].end);
        Ok(HtmlDanglingMarkerClose {
            name,
            start_tag: span,
            span,
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
            let end = name.last().unwrap().span().end;
            return Ok(Node::AttrEmpty(AttrEmpty {
                name,
                span: Span::new(attr_start, end),
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
                    end = seg.span().end;
                    value.push(seg);
                    continue;
                }
                if self.check(TT::LiquidVariableOutputOpen, 0) {
                    let drop = self.parse_liquid_variable_output()?;
                    end = drop.span.end;
                    value.push(Node::LiquidVariableOutput(drop));
                    continue;
                }
                break;
            }
            let start = value.first().map_or(self.peek().start, |v| v.span().start);
            let attr = Attr {
                name,
                value,
                value_span: Span::new(start, end),
                span: Span::new(attr_start, end),
            };
            return Ok(Node::AttrUnquoted(attr));
        };
        let value = self.parse_quoted_attribute_value()?;
        let close = self.consume(TT::HtmlQuoteClose)?;
        let attr = Attr {
            name,
            value,
            value_span: Span::new(quote.end, close.start),
            span: Span::new(attr_start, close.end),
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
        while self.check(TT::Text, 0) && self.is_space_token(self.tokens[self.p]) {
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
        // The kinds of the segments, recorded as they arrive, so that the checks for each glued
        // tag do not read the whole name again.
        let (mut has_text, mut has_output) = (false, false);
        let mut lookahead = BodyLookahead::default();
        while !self.is_at_end() {
            if self.check(TT::LiquidVariableOutputOpen, 0) {
                segments.push(Node::LiquidVariableOutput(
                    self.parse_liquid_variable_output()?,
                ));
                has_output = true;
                continue;
            }
            if !self.in_attribute_context
                && self.check(TT::LiquidTagOpen, 0)
                && !has_output
                && !self.liquid_tag_starts_attribute_list(has_text, &mut lookahead)
            {
                segments.push(self.parse_liquid_tag()?);
                continue;
            }
            match self.consume_text_segment() {
                Some(seg) => {
                    segments.push(seg);
                    has_text = true;
                }
                None => break,
            }
        }
        Ok(segments)
    }

    fn liquid_tag_starts_attribute_list(
        &mut self,
        name_has_text: bool,
        lookahead: &mut BodyLookahead,
    ) -> bool {
        if !name_has_text {
            return false;
        }
        match self.peek_tag_name() {
            Some(name) if BLOCKS.contains(&name) => {
                self.liquid_tag_body_starts_with_whitespace(lookahead)
            }
            _ => false,
        }
    }

    /// Whether the body of the block tag at the cursor starts with rendered whitespace. The scan
    /// reads past every Liquid tag to the first rendered token, so it can also read past the next
    /// blocks glued to the name.
    ///
    /// After the scan reads a `LiquidTagOpen`, it has the state of a scan that starts there:
    /// `in_tag` is true in both, and the next `LiquidTagClose` sets `trim_next` before any token
    /// reads it. So a block that the last scan read past gets the same answer, and the answer is
    /// reused.
    /// Without the reuse, a name of many glued blocks with empty bodies scans to the end of its
    /// HTML tag once for each block, which is quadratic in the length of the name.
    fn liquid_tag_body_starts_with_whitespace(&self, last: &mut BodyLookahead) -> bool {
        if let Some(answer) = last.answer_at(self.token_generation, self.p) {
            return answer;
        }
        let (to, answer) = self.scan_body_start();
        *last = BodyLookahead {
            generation: self.token_generation,
            from: self.p,
            to,
            answer,
        };
        answer
    }

    /// The index of the token that decides the scan, or the number of tokens when no token
    /// does, and whether the body starts with rendered whitespace.
    fn scan_body_start(&self) -> (usize, bool) {
        let source = self.source;
        let (mut in_tag, mut trim_next) = (false, false);
        for i in self.p.. {
            if !self.has_token(i) {
                break;
            }
            let t = self.tokens[i];
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
                    let left_trimming_next = self.has_token(i + 1) && {
                        let n = self.tokens[i + 1];
                        matches!(n.kind, TT::LiquidVariableOutputOpen | TT::LiquidTagOpen)
                            && n.len() == 3
                    };
                    if text.chars().all(is_js_space) && left_trimming_next {
                        continue;
                    }
                    return (i, starts_with_js_space(text));
                }
                TT::LiquidVariableOutputOpen
                | TT::HtmlTagClose
                | TT::HtmlSelfClose
                | TT::EndOfInput
                    if !in_tag =>
                {
                    return (i, false)
                }
                _ => {}
            }
        }
        (self.tokens.len(), false)
    }
}

/// The last body look-ahead of one compound name: the scan of the token vector of `generation`
/// that started at index `from` decided `answer` at index `to`, or ran out of tokens there.
#[derive(Default)]
struct BodyLookahead {
    generation: usize,
    from: usize,
    to: usize,
    answer: bool,
}

impl BodyLookahead {
    fn answer_at(&self, generation: usize, position: usize) -> Option<bool> {
        (self.generation == generation && self.from <= position && position < self.to)
            .then_some(self.answer)
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

/// `findRawTextClose`: the first `</tag_name>` from `from`, read from the source. Liquid tokens
/// are skipped as the tokenizer skips them, and so are raw tag bodies such as `{% comment %}`'s.
/// `None` at an unterminated token or raw tag.
fn find_raw_text_close(source: &str, from: usize, lower: &str) -> Option<(usize, usize)> {
    let b = source.as_bytes();
    let mut i = from;
    while i < b.len() {
        let closer = match (b[i], b.get(i + 1)) {
            (b'{', Some(b'{')) => "}}",
            (b'{', Some(b'%')) => "%}",
            _ => "",
        };
        if !closer.is_empty() {
            let token_end = i + 2 + crate::find_ascii(&source[i + 2..], closer)? + 2;
            let name = (closer == "%}")
                .then(|| liquid_tag_token_name(&source[i..token_end]))
                .flatten();
            i = match name.and_then(|n| Some((n, rule_for(n)?))) {
                Some((n, rule)) => find_raw_body_end(source, token_end, n, rule)?.tag_end,
                None => token_end,
            };
            continue;
        }
        let name_end = i + 2 + lower.len();
        if b[i..].starts_with(b"</")
            && b.get(i + 2..name_end)
                .is_some_and(|n| n.eq_ignore_ascii_case(lower.as_bytes()))
        {
            let rest = &source[name_end..];
            let after = rest.trim_start_matches(is_js_space);
            if after.starts_with('>') {
                return Some((i, source.len() - after.len() + 1));
            }
        }
        i += 1;
    }
    None
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

    fn element<'n, 'a>(node: &'n Node<'a>) -> (&'n [Node<'a>], &'n [Node<'a>]) {
        match node {
            Node::HtmlElement(e) => (&e.name, &e.attributes),
            Node::HtmlSelfClosingElement(e) => (&e.name, &e.attributes),
            node => panic!("{node:?}"),
        }
    }

    fn is_text(node: &Node, value: &str) -> bool {
        matches!(node, Node::TextNode(t) if t.value == value)
    }

    #[test]
    fn parses_blocks_glued_to_a_name_in_linear_time() {
        // A block glued to the text of a name looks ahead to the first rendered token of its body,
        // to decide whether it opens the attribute list. An empty body renders nothing, so each
        // look-ahead read to the end of the HTML tag, and the time grew with the square of the
        // number of blocks. The check for an output segment also read the whole name again for
        // each glued block, with a body or not. `plain` parses the same blocks as children.
        let time = |source: &str| {
            let start = std::time::Instant::now();
            assert!(crate::parse(source).is_ok());
            start.elapsed()
        };
        for (n, block) in [
            (10_000, "{% if x %}{% endif %}"),
            (50_000, "{% if x %}b{% endif %}"),
        ] {
            let blocks = block.repeat(n);
            let plain = time(&format!("<div><a/>{blocks}{blocks}</div>"));
            for glued in [
                format!("<div><a{blocks}/></div>"),
                format!("<a{blocks}>c</a{blocks}>"),
            ] {
                let took = time(&glued);
                assert!(
                    took < 5 * plain,
                    "{took:?}, plain {plain:?}: {}",
                    &glued[..40]
                );
            }
        }
    }

    #[test]
    fn keeps_glued_empty_blocks_in_the_name() {
        let blocks = "{% if x %}{% endif %}".repeat(3);
        for source in [format!("<a{blocks}/>"), format!("<a{blocks}>c</a{blocks}>")] {
            let doc = crate::parse(&source).unwrap();
            let (name, attributes) = element(&doc.children[0]);
            assert_eq!(name.len(), 4, "{source}");
            assert!(is_text(&name[0], "a"), "{source}");
            assert!(name[1..].iter().all(|n| matches!(n, Node::LiquidTag(_))));
            assert!(attributes.is_empty(), "{source}");
        }
        // Whitespace after the blocks still opens the attribute list.
        let source = format!("<a{blocks} />");
        let doc = crate::parse(&source).unwrap();
        let (name, attributes) = element(&doc.children[0]);
        assert_eq!((name.len(), attributes.len()), (1, 3));
    }

    #[test]
    fn decides_glued_blocks_after_an_empty_block_by_the_first_rendered_token() {
        for (source, name_len, attributes_len) in [
            // The look-ahead of the first block reads past the empty block to the body of the
            // second, so both blocks get the answer of that body.
            ("<a{% if x %}{% endif %}{% if y %} data-y{% endif %}>c</a>", 1, 2),
            (
                "<a{% if x %}{% endif %}{% if y %}-b{% endif %}>c</a{% if x %}{% endif %}{% if y %}-b{% endif %}>",
                3,
                0,
            ),
            (
                "<a{% if x %}{% endif %}{% if y -%} b{% endif %}>c</a{% if x %}{% endif %}{% if y -%} b{% endif %}>",
                3,
                0,
            ),
            (
                "<a{% if x %}{% endif %}{% if y %}{{ y }}{% endif %}>c</a{% if x %}{% endif %}{% if y %}{{ y }}{% endif %}>",
                3,
                0,
            ),
            // The body of the first block decides the first block only: the second block gets
            // the answer of its own body.
            (
                "<a{% if x %}b{% endif %}{% if y %} c{% endif %}>d</a{% if x %}b{% endif %}>",
                2,
                1,
            ),
        ] {
            let doc = crate::parse(source).unwrap();
            let (name, attributes) = element(&doc.children[0]);
            assert!(is_text(&name[0], "a"), "{source}");
            assert_eq!((name.len(), attributes.len()), (name_len, attributes_len), "{source}");
        }
    }
}
