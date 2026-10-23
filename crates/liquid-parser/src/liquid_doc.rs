//! Port of `liquid-doc/tokenizer.ts` and `liquid-doc/parser.ts`.
//!
//! Token positions are absolute (TS adds `startOffset` to every body index).

use std::borrow::Cow;

use liquid_ast::*;

use crate::{js_trim, js_trim_start};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum K {
    Annotation,
    TextLine,
    Newline,
    EndOfInput,
}

#[derive(Clone, Copy, Debug)]
struct Tok {
    kind: K,
    start: usize,
    end: usize,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum P {
    Type,
    OptionalName,
    Word,
    Dash,
    Text,
    EndOfInput,
}

#[derive(Clone, Copy, Debug)]
struct PTok {
    kind: P,
    start: usize,
    end: usize,
}

/// `\w`
fn is_word(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

/// `/[ \t]+/y`, returning `i` when nothing matches.
fn skip_blank(b: &[u8], mut i: usize, end: usize) -> usize {
    while i < end && (b[i] == b' ' || b[i] == b'\t') {
        i += 1;
    }
    i
}

fn find(b: &[u8], c: u8, from: usize, end: usize) -> Option<usize> {
    b[from..end].iter().position(|&x| x == c).map(|i| i + from)
}

/// `/.@\w+/` on `source[pos..line_end]`: the first `@` past the line start that follows a
/// non-line-terminator and precedes a word char.
fn midline_annotation(b: &[u8], pos: usize, line_end: usize) -> Option<usize> {
    let mut j = pos + 1;
    while let Some(at) = find(b, b'@', j, line_end) {
        let prev_ok = b[at - 1] != b'\r'
            && !(at >= pos + 3
                && b[at - 3..at - 1] == [0xe2, 0x80]
                && matches!(b[at - 1], 0xa8 | 0xa9));
        if prev_ok && at + 1 < line_end && is_word(b[at + 1]) {
            return Some(at);
        }
        j = at + 1;
    }
    None
}

/// `tokenizeLiquidDoc`
fn tokenize_liquid_doc(source: &str, start: usize, end: usize) -> Vec<Tok> {
    let b = source.as_bytes();
    let mut tokens = Vec::new();
    let mut push = |kind, start, end| tokens.push(Tok { kind, start, end });
    let mut pos = start;
    let mut after_annotation = false;
    while pos < end {
        let nl = match b[pos] {
            b'\n' => pos + 1,
            b'\r' if pos + 1 < end && b[pos + 1] == b'\n' => pos + 2,
            _ => 0,
        };
        if nl != 0 {
            push(K::Newline, pos, nl);
            pos = nl;
            after_annotation = false;
            continue;
        }
        let after_ws = skip_blank(b, pos, end);
        if after_ws + 1 < end && b[after_ws] == b'@' && is_word(b[after_ws + 1]) {
            let mut e = after_ws + 2;
            while e < end && is_word(b[e]) {
                e += 1;
            }
            push(K::Annotation, after_ws, e);
            pos = skip_blank(b, e, end);
            after_annotation = true;
            continue;
        }
        let slice_end = find(b, b'\n', pos, end).unwrap_or(end);
        let mut effective_end = slice_end;
        if !after_annotation {
            if let Some(at) = midline_annotation(b, pos, slice_end) {
                effective_end = at;
            }
        }
        if effective_end > pos {
            push(K::TextLine, pos, effective_end);
        }
        pos = effective_end;
        after_annotation = false;
    }
    push(K::EndOfInput, end, end);
    tokens
}

/// `readTypeEnd`
fn read_type_end(b: &[u8], start: usize, end: usize) -> Option<usize> {
    if b[start] != b'{' {
        return None;
    }
    let mut pos = start + 1;
    while pos < end {
        let ch = b[pos];
        if ch == b'\'' || ch == b'"' {
            match find(b, ch, pos + 1, end) {
                None => return find(b, b'}', pos + 1, end).map(|e| e + 1),
                Some(q) => pos = q,
            }
        } else if ch == b'}' {
            return Some(pos + 1);
        }
        pos += 1;
    }
    None
}

/// `tokenizeParamContent`
fn tokenize_param_content(source: &str, start: usize, end: usize) -> Vec<PTok> {
    let b = source.as_bytes();
    let mut tokens = Vec::new();
    let mut push = |kind, start, end| tokens.push(PTok { kind, start, end });
    let mut pos = start;
    while pos < end {
        if b[pos] == b' ' || b[pos] == b'\t' {
            pos = skip_blank(b, pos, end);
            continue;
        }
        if let Some(type_end) = read_type_end(b, pos, end) {
            push(P::Type, pos, type_end);
            pos = type_end;
            continue;
        }
        if b[pos] == b'[' {
            if let Some(close) = find(b, b']', pos + 1, end) {
                push(P::OptionalName, pos, close + 1);
                pos = close + 1;
                continue;
            }
        }
        if b[pos] == b'-' && (pos + 1 >= end || b[pos + 1] == b' ' || b[pos + 1] == b'\t') {
            push(P::Dash, pos, pos + 1);
            pos += 1;
            continue;
        }
        if is_word(b[pos]) {
            let mut e = pos + 1;
            while e < end && (is_word(b[e]) || b[e] == b'-') {
                e += 1;
            }
            push(P::Word, pos, e);
            pos = e;
            continue;
        }
        push(P::Text, pos, end);
        pos = end;
    }
    push(P::EndOfInput, end, end);
    tokens
}

fn text<'a>(value: impl Into<Str<'a>>, start: usize, end: usize) -> TextNode<'a> {
    TextNode {
        value: value.into(),
        position: Position::new(start, end),
    }
}

/// `parseLiquidDoc(source.slice(start, end), start, source)`
pub(crate) fn parse_liquid_doc(source: &str, start: usize, end: usize) -> Vec<Node<'_>> {
    let tokens = tokenize_liquid_doc(source, start, end);
    DocParser {
        source,
        tokens,
        p: 0,
    }
    .parse()
}

struct DocParser<'a> {
    source: &'a str,
    tokens: Vec<Tok>,
    p: usize,
}

impl<'a> DocParser<'a> {
    fn value(&self, t: Tok) -> &'a str {
        match t.kind {
            K::Annotation => &self.source[t.start + 1..t.end],
            _ => &self.source[t.start..t.end],
        }
    }

    fn peek(&self) -> Tok {
        self.tokens[self.p]
    }

    fn check(&self, kind: K) -> bool {
        self.peek().kind == kind
    }

    fn is_at_end(&self) -> bool {
        self.check(K::EndOfInput)
    }

    fn accept(&mut self, kind: K) -> Option<Tok> {
        let t = self.peek();
        (t.kind == kind).then(|| {
            self.p += 1;
            t
        })
    }

    fn is_blank_line(&self, t: Tok) -> bool {
        t.kind == K::TextLine && js_trim(self.value(t)).is_empty()
    }

    fn parse(mut self) -> Vec<Node<'a>> {
        let mut nodes = Vec::new();
        self.skip_blank_lines();
        if self.check(K::TextLine) {
            let (value, start, end) = self.collect_content_lines(false, false);
            nodes.push(Node::LiquidDocDescriptionNode(LiquidDocDescriptionNode {
                content: text(value, start, end),
                is_implicit: true,
                is_inline: true,
                position: Position::new(start, end),
            }));
        }
        self.skip_blank_lines();
        while !self.is_at_end() {
            let t = self.peek();
            match t.kind {
                K::Newline => self.skip_newlines(),
                K::Annotation => {
                    let node = self.parse_annotation();
                    nodes.push(node);
                }
                K::TextLine if self.is_blank_line(t) => self.p += 1,
                _ => {
                    let (value, start, end) = self.collect_content_lines(false, true);
                    if !js_trim(&value).is_empty() {
                        nodes.push(Node::TextNode(text(value, start, end)));
                    }
                }
            }
        }
        nodes
    }

    fn parse_annotation(&mut self) -> Node<'a> {
        let ann = self.peek();
        self.p += 1;
        let name = self.value(ann);
        if name != "description" && name.starts_with("description") {
            return Node::LiquidDocDescriptionNode(self.parse_glued_description(ann));
        }
        match name {
            "param" => Node::LiquidDocParamNode(self.parse_param(ann)),
            "description" => {
                let (content, is_inline, end) = self.parse_inline_or_block(ann);
                Node::LiquidDocDescriptionNode(LiquidDocDescriptionNode {
                    content,
                    is_implicit: false,
                    is_inline,
                    position: Position::new(ann.start, end),
                })
            }
            "example" => {
                let (content, is_inline, end) = self.parse_inline_or_block(ann);
                Node::LiquidDocExampleNode(LiquidDocExampleNode {
                    content,
                    is_inline,
                    position: Position::new(ann.start, end),
                })
            }
            "prompt" => {
                let (content, end) = self.parse_block_content(ann);
                Node::LiquidDocPromptNode(LiquidDocPromptNode {
                    content,
                    position: Position::new(ann.start, end),
                })
            }
            _ => Node::TextNode(self.parse_unsupported_annotation(ann)),
        }
    }

    fn parse_param(&mut self, ann: Tok) -> LiquidDocParamNode<'a> {
        let Some(inline) = self.accept(K::TextLine) else {
            return LiquidDocParamNode {
                param_name: text("", ann.end, ann.end),
                param_type: None,
                param_description: None,
                required: true,
                position: Position::new(ann.start, ann.end),
            };
        };
        let src = self.source;
        let tokens = tokenize_param_content(src, inline.start, inline.end);
        let mut w = 0;
        let mut accept = |kind| {
            let t = tokens[w];
            (t.kind == kind).then(|| {
                w += 1;
                t
            })
        };
        let inner = |t: PTok| text(&src[t.start + 1..t.end - 1], t.start + 1, t.end - 1);
        let param_type = accept(P::Type).map(inner);
        let (param_name, required) = if let Some(t) = accept(P::OptionalName) {
            (inner(t), false)
        } else if let Some(t) = accept(P::Word) {
            (text(&src[t.start..t.end], t.start, t.end), true)
        } else {
            (text("", ann.end, ann.end), true)
        };
        let dash = accept(P::Dash);
        let rest = &tokens[w..tokens.len() - 1];
        let inline_desc = match (rest.first(), rest.last()) {
            (Some(f), Some(l)) => &src[f.start..l.end],
            _ => "",
        };
        let (continuation, _, cont_end) = self.collect_content_lines(true, true);
        let has_continuation = !js_trim(&continuation).is_empty();
        let mut param_description = None;
        if !inline_desc.is_empty() || has_continuation {
            let full: Str<'a> = if has_continuation {
                Cow::Owned(format!("{inline_desc}{continuation}"))
            } else {
                inline_desc.into()
            };
            let start = match (rest.first(), dash) {
                (Some(f), _) => f.start,
                (None, Some(d)) => d.end + 1,
                (None, None) => ann.end,
            };
            let end = if has_continuation {
                cont_end
            } else {
                rest.last().unwrap().end
            };
            param_description = Some(text(full, start, end));
        }
        let end = param_description
            .as_ref()
            .map_or(inline.end, |d| d.position.end);
        LiquidDocParamNode {
            param_name,
            param_type,
            param_description,
            required,
            position: Position::new(ann.start, end),
        }
    }

    /// Shared body of `parseDescription` and `parseExample`: (content, isInline, end).
    fn parse_inline_or_block(&mut self, ann: Tok) -> (TextNode<'a>, bool, usize) {
        if let Some(inline) = self.accept(K::TextLine) {
            let (rest, _, end_pos) = self.collect_content_lines(false, false);
            let value = self.value(inline);
            let (full, end): (Str<'a>, _) = if js_trim(&rest).is_empty() {
                (value.into(), inline.end)
            } else {
                (Cow::Owned(format!("{value}{rest}")), end_pos)
            };
            return (text(full, inline.start, end), true, end);
        }
        self.skip_blank_lines();
        let (content, end) = self.parse_block_content(ann);
        (content, false, end)
    }

    /// The non-inline tail of `parseDescription`/`parseExample`, and all of `parsePrompt`.
    fn parse_block_content(&mut self, ann: Tok) -> (TextNode<'a>, usize) {
        let (value, start, end) = self.collect_content_lines(false, false);
        if value.is_empty() {
            (text("", ann.end, ann.end), ann.end)
        } else {
            (text(value, start, end), end)
        }
    }

    fn parse_glued_description(&mut self, ann: Tok) -> LiquidDocDescriptionNode<'a> {
        let content_start = ann.start + 1 + "description".len();
        let inline = self.accept(K::TextLine);
        let (rest, _, end_pos) = self.collect_content_lines(false, false);
        let end = if !js_trim(&rest).is_empty() {
            end_pos
        } else {
            inline.map_or(ann.end, |t| t.end)
        };
        LiquidDocDescriptionNode {
            content: text(&self.source[content_start..end], content_start, end),
            is_implicit: false,
            is_inline: true,
            position: Position::new(ann.start, end),
        }
    }

    fn parse_unsupported_annotation(&mut self, ann: Tok) -> TextNode<'a> {
        let end = self.accept(K::TextLine).map_or(ann.end, |t| t.end);
        text(&self.source[ann.start..end], ann.start, end)
    }

    fn skip_newlines(&mut self) {
        while self.check(K::Newline) {
            self.p += 1;
        }
    }

    fn skip_blank_lines(&mut self) {
        while self.check(K::Newline) || self.is_blank_line(self.peek()) {
            self.p += 1;
        }
    }

    /// `collectContentLines`: (value, startPos, endPos).
    fn collect_content_lines(
        &mut self,
        stop_at_paragraph_break: bool,
        trim_trailing_newlines: bool,
    ) -> (String, usize, usize) {
        let mut value = String::new();
        let mut start_pos = self.peek().start;
        let mut end_pos = start_pos;
        while !self.is_at_end() {
            let current = self.peek();
            match current.kind {
                K::Annotation => break,
                K::Newline => {
                    let mut la = self.p + 1;
                    while self.tokens[la].kind == K::Newline || self.is_blank_line(self.tokens[la])
                    {
                        la += 1;
                    }
                    let next = self.tokens[la];
                    if stop_at_paragraph_break
                        && la - self.p >= 2
                        && next.kind == K::TextLine
                        && !self.is_blank_line(next)
                    {
                        break;
                    }
                    if matches!(next.kind, K::Annotation | K::EndOfInput) {
                        // Everything in p..la is a Newline or a blank TextLine.
                        if !trim_trailing_newlines {
                            for t in &self.tokens[self.p..la] {
                                if t.kind == K::Newline {
                                    value.push('\n');
                                }
                                end_pos = t.end;
                            }
                        }
                        self.p = la;
                        break;
                    }
                    value.push('\n');
                    end_pos = current.end;
                    self.p += 1;
                }
                K::TextLine if self.is_blank_line(current) => self.p += 1,
                _ => {
                    let line = self.value(current);
                    if value.is_empty() {
                        let trimmed = js_trim_start(line);
                        start_pos = current.start + (line.len() - trimmed.len());
                        value.push_str(trimmed);
                    } else {
                        value.push_str(line);
                    }
                    end_pos = current.end;
                    self.p += 1;
                }
            }
        }
        (value, start_pos, end_pos)
    }
}
