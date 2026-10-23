//! Port of `markup/tokenizer.ts`, the strict paths of `markup/parser.ts`, and
//! `markup/expression-adapter.ts` (nodes are built in their adapted shape directly).

use std::borrow::Cow;

use liquid_ast::*;

use crate::{is_js_space, ParseError, MAX_DEPTH};

pub(crate) type PResult<T> = Result<T, ParseError>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarkupTokenType {
    Id,
    String,
    Number,
    Dot,
    DotDot,
    Pipe,
    Colon,
    Comma,
    OpenRound,
    CloseRound,
    OpenSquare,
    CloseSquare,
    Dash,
    Comparison,
    Equality,
    Logical,
    EndOfString,
}

impl MarkupTokenType {
    pub fn as_str(self) -> &'static str {
        use MarkupTokenType::*;
        match self {
            Id => "Id",
            String => "String",
            Number => "Number",
            Dot => "Dot",
            DotDot => "DotDot",
            Pipe => "Pipe",
            Colon => "Colon",
            Comma => "Comma",
            OpenRound => "OpenRound",
            CloseRound => "CloseRound",
            OpenSquare => "OpenSquare",
            CloseSquare => "CloseSquare",
            Dash => "Dash",
            Comparison => "Comparison",
            Equality => "Equality",
            Logical => "Logical",
            EndOfString => "EndOfString",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarkupToken<'a> {
    pub kind: MarkupTokenType,
    pub value: &'a str,
    pub start: usize,
    pub end: usize,
}

fn is_word(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// End of `/\d[\d_]*(\.\d[\d_]*)?/` matched at `i` (where `b[i]` is a digit).
fn number_end(b: &[u8], i: usize) -> usize {
    let digits = |mut j: usize| {
        while j < b.len() && (b[j].is_ascii_digit() || b[j] == b'_') {
            j += 1;
        }
        j
    };
    let j = digits(i + 1);
    if j + 1 < b.len() && b[j] == b'.' && b[j + 1].is_ascii_digit() {
        digits(j + 2)
    } else {
        j
    }
}

pub fn tokenize_markup(markup: &str, start_offset: usize) -> Vec<MarkupToken<'_>> {
    use MarkupTokenType as T;
    let b = markup.as_bytes();
    let mut tokens = Vec::with_capacity(b.len() / 3 + 2);
    let mut pos = 0;
    let mut last: Option<T> = None;
    macro_rules! push {
        ($kind:expr, $end:expr) => {{
            let end = $end;
            tokens.push(MarkupToken {
                kind: $kind,
                value: &markup[pos..end],
                start: pos + start_offset,
                end: end + start_offset,
            });
            last = Some($kind);
            pos = end;
            continue;
        }};
    }

    while pos < b.len() {
        let ch = b[pos];
        if ch >= 0x80 {
            let c = markup[pos..].chars().next().unwrap();
            // Whitespace or an unknown character: skipped either way.
            pos += c.len_utf8();
            continue;
        }
        if is_js_space(ch as char) {
            pos += 1;
            continue;
        }
        let next = b.get(pos + 1).copied().unwrap_or(0);

        if ch == b'\'' || ch == b'"' {
            if let Some(close) = markup[pos + 1..].find(ch as char) {
                push!(T::String, pos + 1 + close + 1);
            }
        }
        if ch == b'-' && next.is_ascii_digit() {
            push!(T::Number, number_end(b, pos + 1));
        }
        if ch.is_ascii_digit() {
            push!(T::Number, number_end(b, pos));
        }
        if ch.is_ascii_alphabetic() || ch == b'_' {
            let mut end = pos + 1;
            while end < b.len() && (is_word(b[end]) || b[end] == b'-') {
                end += 1;
            }
            if end < b.len() && b[end] == b'?' {
                end += 1;
            }
            let value = &markup[pos..end];
            let mut kind = T::Id;
            if last != Some(T::Dot) {
                if value == "contains" {
                    kind = T::Comparison;
                } else if value == "and" || value == "or" {
                    kind = T::Logical;
                }
            }
            push!(kind, end);
        }
        match (ch, next) {
            (b'=', b'=') | (b'!', b'=') => push!(T::Equality, pos + 2),
            (b'>', b'=') | (b'<', b'=') => push!(T::Comparison, pos + 2),
            (b'.', b'.') => push!(T::DotDot, pos + 2),
            _ => {}
        }
        let single = match ch {
            b'.' => T::Dot,
            b'|' => T::Pipe,
            b':' => T::Colon,
            b',' => T::Comma,
            b'(' => T::OpenRound,
            b')' => T::CloseRound,
            b'[' => T::OpenSquare,
            b']' => T::CloseSquare,
            b'-' => T::Dash,
            b'>' | b'<' => T::Comparison,
            b'=' => T::Equality,
            _ => {
                pos += 1;
                continue;
            }
        };
        push!(single, pos + 1);
    }

    let end = b.len() + start_offset;
    tokens.push(MarkupToken {
        kind: T::EndOfString,
        value: "",
        start: end,
        end,
    });
    tokens
}

/// `s in LiquidLiteralValues`: the six keywords, plus the `Object.prototype` property names
/// JS's `in` also finds.
pub(crate) fn literal_keyword(s: &str) -> Option<&'static str> {
    crate::LIQUID_LITERAL_KEYWORDS
        .iter()
        .chain(crate::tags::PROTO_NAMES)
        .copied()
        .find(|k| *k == s)
}

fn is_comparison_op(s: &str) -> Option<&'static str> {
    ["==", "!=", "<", ">", "<=", ">=", "contains"]
        .into_iter()
        .find(|op| *op == s)
}

fn string_node<'a>(t: &MarkupToken<'a>) -> LiquidString<'a> {
    LiquidString {
        single: Some(t.value.as_bytes()[0] == b'\''),
        value: Cow::Borrowed(&t.value[1..t.value.len() - 1]),
        position: Position::new(t.start, t.end),
    }
}

pub struct MarkupParser<'a> {
    tokens: Vec<MarkupToken<'a>>,
    source: &'a str,
    p: usize,
    markup_start: usize,
    markup_end: usize,
    /// Expressions open around `p`.
    depth: usize,
}

impl<'a> MarkupParser<'a> {
    /// `new MarkupParser(tokens, source)`. `tokens` must end with an `EndOfString` token.
    pub fn new(tokens: Vec<MarkupToken<'a>>, source: &'a str) -> Self {
        let markup_start = tokens.first().map_or(0, |t| t.start);
        let markup_end = tokens
            .iter()
            .rev()
            .find(|t| t.kind != MarkupTokenType::EndOfString)
            .map_or(markup_start, |t| t.end);
        MarkupParser {
            tokens,
            source,
            p: 0,
            markup_start,
            markup_end,
            depth: 0,
        }
    }

    pub(crate) fn with_range(
        tokens: Vec<MarkupToken<'a>>,
        source: &'a str,
        start: usize,
        end: usize,
    ) -> Self {
        MarkupParser {
            tokens,
            source,
            p: 0,
            markup_start: start,
            markup_end: end,
            depth: 0,
        }
    }

    /// `f` one expression deeper, failing past [`MAX_DEPTH`].
    fn nested<T>(&mut self, f: impl FnOnce(&mut Self) -> PResult<T>) -> PResult<T> {
        if self.depth == MAX_DEPTH {
            return Err(ParseError::too_deep());
        }
        self.depth += 1;
        let r = f(self);
        self.depth -= 1;
        r
    }

    fn error(&self, message: String, t: &MarkupToken) -> ParseError {
        ParseError::liquid(message, t.start, t.end)
    }

    pub fn consume(&mut self, kind: MarkupTokenType) -> PResult<MarkupToken<'a>> {
        let t = self.tokens[self.p];
        if t.kind != kind {
            return Err(self.error(
                format!(
                    "Expected {} but found {} ({})",
                    kind.as_str(),
                    t.kind.as_str(),
                    t.value
                ),
                &t,
            ));
        }
        self.p += 1;
        Ok(t)
    }

    pub fn consume_optional(&mut self, kind: MarkupTokenType) -> Option<MarkupToken<'a>> {
        let t = self.tokens[self.p];
        if t.kind != kind {
            return None;
        }
        self.p += 1;
        Some(t)
    }

    pub fn look(&self, kind: MarkupTokenType, ahead: usize) -> bool {
        self.tokens
            .get(self.p + ahead)
            .is_some_and(|t| t.kind == kind)
    }

    pub fn peek(&self) -> MarkupToken<'a> {
        self.tokens[self.p]
    }

    pub fn id(&mut self, keyword: &str) -> bool {
        let t = self.tokens[self.p];
        if t.kind != MarkupTokenType::Id || t.value != keyword {
            return false;
        }
        self.p += 1;
        true
    }

    pub fn is_at_end(&self) -> bool {
        self.tokens[self.p].kind == MarkupTokenType::EndOfString
    }

    fn eos_start(&self) -> usize {
        self.tokens[self.tokens.len() - 1].start
    }

    /// Advances to the end; returns the full markup range (`bodyContext`).
    pub(crate) fn body_context(&mut self) -> (usize, usize) {
        while !self.is_at_end() {
            self.p += 1;
        }
        (self.markup_start, self.markup_end)
    }

    pub fn value_expression(&mut self) -> PResult<Node<'a>> {
        use MarkupTokenType as T;
        let t = self.peek();
        match t.kind {
            T::String => {
                self.p += 1;
                Ok(Node::String(string_node(&t)))
            }
            T::Number => {
                self.p += 1;
                Ok(Node::Number(LiquidNumber {
                    value: Cow::Borrowed(t.value),
                    position: Position::new(t.start, t.end),
                }))
            }
            T::Id => {
                if let Some(keyword) = literal_keyword(t.value) {
                    if !self.look(T::Dot, 1) && !self.look(T::OpenSquare, 1) {
                        self.p += 1;
                        return Ok(Node::LiquidLiteral(LiquidLiteral {
                            keyword,
                            position: Position::new(t.start, t.end),
                        }));
                    }
                }
                Ok(Node::VariableLookup(self.variable_lookup()?))
            }
            T::OpenSquare => Ok(Node::VariableLookup(self.variable_lookup()?)),
            T::OpenRound => {
                let open = self.consume(T::OpenRound)?;
                let start = self.nested(Self::value_expression)?;
                self.consume(T::DotDot)?;
                let end = self.nested(Self::value_expression)?;
                let close = self.consume(T::CloseRound)?;
                Ok(Node::Range(LiquidRange {
                    start: Box::new(start),
                    end: Box::new(end),
                    position: Position::new(open.start, close.end),
                }))
            }
            _ => Err(self.error(
                format!(
                    "Expected expression but found {} ({})",
                    t.kind.as_str(),
                    t.value
                ),
                &t,
            )),
        }
    }

    pub fn variable_lookup(&mut self) -> PResult<VariableLookup<'a>> {
        use MarkupTokenType as T;
        let current = self.peek();
        let (name, start) = match current.kind {
            T::Id => {
                self.p += 1;
                (Some(Cow::Borrowed(current.value)), current.start)
            }
            T::OpenSquare => (None, current.start),
            _ => {
                return Err(self.error(
                    format!(
                        "Expected identifier or [ but found {} ({})",
                        current.kind.as_str(),
                        current.value
                    ),
                    &current,
                ))
            }
        };
        let mut lookups = Vec::new();
        let mut modes = Vec::new();
        let mut end = if name.is_some() { current.end } else { start };
        while !self.is_at_end() {
            if self.consume_optional(T::Dot).is_some() {
                let prop = self.consume(T::Id)?;
                lookups.push(Node::String(LiquidString {
                    single: None,
                    value: Cow::Borrowed(prop.value),
                    position: Position::new(prop.start, prop.end),
                }));
                modes.push(LookupMode::Bareword);
                end = prop.end;
            } else if self.look(T::OpenSquare, 0) {
                self.p += 1;
                let inner = self.nested(Self::value_expression)?;
                let close = self.consume(T::CloseSquare)?;
                lookups.push(inner);
                modes.push(LookupMode::Subscript);
                end = close.end;
            } else {
                break;
            }
        }
        Ok(VariableLookup {
            name,
            lookups,
            lookup_modes: Some(modes),
            position: Position::new(start, end),
        })
    }

    fn comparison(&mut self) -> PResult<Node<'a>> {
        use MarkupTokenType as T;
        let left = self.value_expression()?;
        let t = self.peek();
        if t.kind != T::Comparison && t.kind != T::Equality {
            return Ok(left);
        }
        let Some(comparator) = is_comparison_op(t.value) else {
            return Err(self.error(format!("Unknown operator {}", t.value), &t));
        };
        self.p += 1;
        let right = self.value_expression()?;
        let position = Position::new(left.position().start, right.position().end);
        Ok(Node::Comparison(Comparison {
            comparator,
            left: Box::new(left),
            right: Box::new(right),
            position,
        }))
    }

    /// `logicalExpr` + `adaptConditional`.
    fn logical_expr(&mut self) -> PResult<Node<'a>> {
        let left = self.comparison()?;
        let t = self.peek();
        if t.kind != MarkupTokenType::Logical {
            return Ok(left);
        }
        let relation = if t.value == "and" { "and" } else { "or" };
        self.p += 1;
        let mut right = self.nested(Self::logical_expr)?;
        let position = Position::new(left.position().start, right.position().end);
        if let Node::LogicalExpression(r) = &mut right {
            r.position.start = t.start;
        }
        Ok(Node::LogicalExpression(LogicalExpression {
            relation,
            left: Box::new(left),
            right: Box::new(right),
            position,
        }))
    }

    pub(crate) fn conditional_expression(&mut self) -> PResult<Node<'a>> {
        let mut result = self.logical_expr()?;
        let end = self.eos_start();
        let mut node = &mut result;
        while let Node::LogicalExpression(l) = node {
            l.position.end = end;
            node = &mut l.right;
        }
        Ok(result)
    }

    /// `expression` (`adaptComplex(logicalExpr())`).
    fn expression(&mut self) -> PResult<Node<'a>> {
        let e = self.logical_expr()?;
        Ok(match e {
            Node::Comparison(_) | Node::LogicalExpression(_) => {
                let position = e.position();
                Node::BooleanExpression(BooleanExpression {
                    condition: Box::new(e),
                    position,
                })
            }
            e => e,
        })
    }

    pub fn liquid_variable(&mut self) -> PResult<LiquidVariable<'a>> {
        let expr = self.expression()?;
        let ep = expr.position();
        let filters = self.filters(ep.end)?;
        let token_end = filters.last().map_or(ep.end, |f| f.position.end);
        Ok(LiquidVariable {
            expression: Box::new(expr),
            filters,
            raw_source: Cow::Borrowed(&self.source[ep.start..token_end]),
            position: Position::new(ep.start, self.eos_start()),
        })
    }

    fn filters(&mut self, mut previous_end: usize) -> PResult<Vec<LiquidFilter<'a>>> {
        let mut result = Vec::new();
        while self.consume_optional(MarkupTokenType::Pipe).is_some() {
            let f = self.filter(previous_end)?;
            previous_end = f.position.end;
            result.push(f);
        }
        Ok(result)
    }

    fn filter(&mut self, previous_end: usize) -> PResult<LiquidFilter<'a>> {
        use MarkupTokenType as T;
        let name = self.consume(T::Id)?;
        let mut args = Vec::new();
        let mut end = name.end;
        if let Some(colon) = self.consume_optional(T::Colon) {
            end = colon.end;
            let at_boundary = self.is_at_end() || self.look(T::Pipe, 0);
            let only_ws = self.source[colon.end..self.peek().start]
                .chars()
                .all(is_js_space);
            if !(at_boundary && only_ws) {
                args = self.arguments()?;
            }
            if let Some(a) = args.last() {
                end = a.position().end;
            }
        }
        Ok(LiquidFilter {
            name: Cow::Borrowed(name.value),
            args,
            position: Position::new(previous_end, end),
        })
    }

    fn argument(&mut self) -> PResult<Node<'a>> {
        use MarkupTokenType as T;
        if self.look(T::Id, 0) {
            let mut ahead = 1;
            while self.look(T::Dot, ahead) && self.look(T::Id, ahead + 1) {
                ahead += 2;
            }
            if self.look(T::Colon, ahead) {
                return Ok(Node::NamedArgument(self.named_argument()?));
            }
        }
        self.value_expression()
    }

    /// `id ("." id)* ":"`, returning the joined name and the first token's start.
    fn argument_name(&mut self) -> PResult<(Str<'a>, usize)> {
        let first = self.consume(MarkupTokenType::Id)?;
        let mut name = Cow::Borrowed(first.value);
        while self.consume_optional(MarkupTokenType::Dot).is_some() {
            let segment = self.consume(MarkupTokenType::Id)?;
            let n = name.to_mut();
            n.push('.');
            n.push_str(segment.value);
        }
        self.consume(MarkupTokenType::Colon)?;
        Ok((name, first.start))
    }

    pub fn named_argument(&mut self) -> PResult<NamedArgument<'a>> {
        let (name, start) = self.argument_name()?;
        let value = self.value_expression()?;
        let position = Position::new(start, value.position().end);
        Ok(NamedArgument {
            name,
            value: Box::new(value),
            position,
        })
    }

    pub(crate) fn arguments(&mut self) -> PResult<Vec<Node<'a>>> {
        let mut args = vec![self.argument()?];
        while self.consume_optional(MarkupTokenType::Comma).is_some() {
            args.push(self.argument()?);
        }
        Ok(args)
    }

    pub fn named_arguments(&mut self) -> PResult<Vec<NamedArgument<'a>>> {
        let mut args = vec![self.named_argument()?];
        while self.consume_optional(MarkupTokenType::Comma).is_some() {
            if !self.look(MarkupTokenType::Id, 0) {
                break;
            }
            args.push(self.named_argument()?);
        }
        Ok(args)
    }

    pub(crate) fn block_named_arguments(&mut self) -> PResult<Vec<NamedArgument<'a>>> {
        let mut args = vec![self.block_named_argument()?];
        while self.consume_optional(MarkupTokenType::Comma).is_some() {
            if !self.look(MarkupTokenType::Id, 0) {
                break;
            }
            args.push(self.block_named_argument()?);
        }
        Ok(args)
    }

    fn block_named_argument(&mut self) -> PResult<NamedArgument<'a>> {
        use MarkupTokenType as T;
        let (name, start) = self.argument_name()?;
        let value = if self.look(T::OpenSquare, 0) {
            let open = self.consume(T::OpenSquare)?;
            let mut elements = Vec::new();
            while !self.look(T::CloseSquare, 0) {
                if self.look(T::OpenSquare, 0) {
                    let t = self.peek();
                    return Err(self.error(
                        "nested arrays are not supported in block array literal".into(),
                        &t,
                    ));
                }
                elements.push(self.value_expression()?);
                if !self.look(T::CloseSquare, 0) {
                    self.consume(T::Comma)?;
                }
            }
            let close = self.consume(T::CloseSquare)?;
            Node::BlockArrayLiteral(BlockArrayLiteral {
                elements,
                position: Position::new(open.start, close.end),
            })
        } else {
            self.value_expression()?
        };
        let position = Position::new(start, value.position().end);
        Ok(NamedArgument {
            name,
            value: Box::new(value),
            position,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_markup() {
        let kinds: Vec<_> = tokenize_markup("a.and -1.5..2 contains 'x' é", 10)
            .iter()
            .map(|t| (t.kind.as_str(), t.value, t.start))
            .collect();
        assert_eq!(
            kinds,
            vec![
                ("Id", "a", 10),
                ("Dot", ".", 11),
                ("Id", "and", 12),
                ("Number", "-1.5", 16),
                ("DotDot", "..", 20),
                ("Number", "2", 22),
                ("Comparison", "contains", 24),
                ("String", "'x'", 33),
                ("EndOfString", "", 39),
            ]
        );
    }
}
