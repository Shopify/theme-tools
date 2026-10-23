//! `checks/liquid-syntax-error/utils.ts`
//!
//! TS helpers that take a `markup: string` take a [`Scan`] here, so one markup string is
//! tokenized once however many helpers look at it. `hasSingleIdMarkup` and
//! `hasRubyAcceptedWhitespaceSeparatedQuotePrefix` are only used by specs and aren't ported.

use liquid_ast::{LiquidVariable, Node, Position};
use liquid_parser::{
    tokenize, tokenize_markup, MarkupParser, MarkupToken, MarkupTokenType as T, ParseError, Token,
    TokenType,
};

/// `resolveErrorLocation(error, source)`, in bytes.
pub fn resolve_error_location(error: &ParseError, source: &str) -> (usize, usize) {
    match error.loc {
        Some(loc) => (
            get_offset(source, loc.start.line, loc.start.column),
            get_offset(source, loc.end.line, loc.end.column),
        ),
        None => (0, source.len()),
    }
}

/// `getOffset(source, line, column)`: a 1-based line and UTF-16 column to a byte offset. Also
/// stands in for line-column's `toIndex`, which agrees on every location the parser produces.
pub fn get_offset(source: &str, line: usize, column: usize) -> usize {
    let line_start = match line {
        0 => return source.len(),
        1 => 0,
        _ => match source.match_indices('\n').nth(line - 2) {
            Some((i, _)) => i + 1,
            None => return source.len(),
        },
    };
    if line_start >= source.len() {
        return source.len();
    }
    // ponytail: a column inside a surrogate pair rounds up to the next char.
    let units = column.saturating_sub(1);
    let mut n = 0;
    for (i, c) in source[line_start..].char_indices() {
        if n >= units {
            return line_start + i;
        }
        n += c.len_utf16();
    }
    // Past the end, the runner counts one UTF-16 unit per byte.
    source.len() + units.saturating_sub(n)
}

/// JS `source.slice(from, to)` on byte offsets.
pub fn js_slice(source: &str, from: usize, to: usize) -> &str {
    let to = to.min(source.len());
    if from >= to {
        return "";
    }
    &source[from..to]
}

/// `hasBareArrayAccess(expr)`
pub fn has_bare_array_access(expr: &Node) -> bool {
    matches!(expr, Node::VariableLookup(v) if v.name.is_none())
}

/// `argHasBareArrayAccess(arg)`
pub fn arg_has_bare_array_access(arg: &Node) -> bool {
    match arg {
        Node::NamedArgument(a) => has_bare_array_access(&a.value),
        _ => has_bare_array_access(arg),
    }
}

/// `variableHasBareArrayAccess(variable)`
pub fn variable_has_bare_array_access(variable: &LiquidVariable) -> bool {
    has_bare_array_access(&variable.expression)
        || variable
            .filters
            .iter()
            .any(|f| f.args.iter().any(arg_has_bare_array_access))
}

/// `conditionalHasBareArrayAccess(expr)`
pub fn conditional_has_bare_array_access(expr: &Node) -> bool {
    match expr {
        Node::LogicalExpression(l) => {
            conditional_has_bare_array_access(&l.left)
                || conditional_has_bare_array_access(&l.right)
        }
        Node::Comparison(c) => has_bare_array_access(&c.left) || has_bare_array_access(&c.right),
        _ => has_bare_array_access(expr),
    }
}

/// `rawMarkup(node)`
pub fn raw_markup(source: &str, markup_position: Position) -> &str {
    js_slice(source, markup_position.start, markup_position.end)
}

/// A markup string and its `meaningfulTokens` (`tokenizeMarkup` minus `EndOfString`).
pub struct Scan<'a> {
    pub markup: &'a str,
    pub tokens: Vec<MarkupToken<'a>>,
}

impl<'a> Scan<'a> {
    pub fn new(markup: &'a str) -> Self {
        let mut tokens = tokenize_markup(markup, 0);
        tokens.pop();
        Scan { markup, tokens }
    }

    /// `uncoveredCharacters(markup, allowPrefixQuotes)`: chars no token claims, minus whitespace.
    fn uncovered(&self, allow_prefix_quotes: bool) -> impl Iterator<Item = char> + '_ {
        let mut k = 0;
        self.markup.char_indices().filter_map(move |(i, c)| {
            while k < self.tokens.len() && self.tokens[k].end <= i {
                k += 1;
            }
            let covered = k < self.tokens.len() && self.tokens[k].start <= i;
            (!(is_whitespace(c) || covered || (allow_prefix_quotes && is_quote(c)))).then_some(c)
        })
    }
}

/// `hasSkippedCharacters(markup)`
pub fn has_skipped_characters(m: &Scan) -> bool {
    m.uncovered(false).next().is_some()
}

/// `hasEmptyMarkup(markup)`
pub fn has_empty_markup(m: &Scan) -> bool {
    m.tokens.is_empty() && !has_skipped_characters(m)
}

/// `hasSingleStringMarkup(markup, value)`
pub fn has_single_string_markup(m: &Scan, value: &str) -> bool {
    match m.tokens.as_slice() {
        [t] if t.kind == T::String => {
            &t.value[1..t.value.len() - 1] == value && !has_skipped_characters(m)
        }
        _ => false,
    }
}

/// `hasRubyValidInlineCommentMarkup(markup)`
pub fn has_ruby_valid_inline_comment_markup(m: &Scan) -> bool {
    // `inlineCommentLines`: each line's first non-whitespace char, if any, and whether a token
    // covers it.
    let (mut first_line_has_event, mut continuation_lines, mut prefixed_continuation_lines) =
        (false, 0, 0);
    let (mut line, mut line_has_event, mut k) = (0, false, 0);
    for (i, c) in m.markup.char_indices() {
        if c == '\n' {
            line += 1;
            line_has_event = false;
            continue;
        }
        if is_whitespace(c) || line_has_event {
            continue;
        }
        line_has_event = true;
        while k < m.tokens.len() && m.tokens[k].end <= i {
            k += 1;
        }
        let covered = k < m.tokens.len() && m.tokens[k].start <= i;
        if line == 0 {
            first_line_has_event = true;
        } else {
            continuation_lines += 1;
            if !covered && c == '#' {
                prefixed_continuation_lines += 1;
            }
        }
    }

    if continuation_lines == 0 {
        return true;
    }
    if !first_line_has_event && continuation_lines == 1 {
        return true;
    }
    continuation_lines == prefixed_continuation_lines
}

/// `hasRubyAcceptedCycleTrailingComma(markup)`
pub fn has_ruby_accepted_cycle_trailing_comma(m: &Scan) -> bool {
    tokens_before_single_terminal_comma(m)
        .is_some_and(|tokens| parses_complete_value_expression(tokens, m.markup))
}

/// `hasRubyAcceptedLoopTrailingComma(markup)`
pub fn has_ruby_accepted_loop_trailing_comma(m: &Scan) -> bool {
    let Some(tokens) = tokens_before_single_terminal_comma(m) else {
        return false;
    };
    let mut parser = markup_parser_for_tokens(tokens, m.markup);
    let parsed = (|| {
        parser.consume(T::Id)?;
        if !parser.id("in") {
            return Ok(false);
        }
        parser.value_expression()?;
        parser.id("reversed");
        while !parser.is_at_end() {
            parser.consume_optional(T::Comma);
            parser.named_argument()?;
        }
        Ok::<_, ParseError>(true)
    })();
    parsed.unwrap_or(false) && parser.is_at_end()
}

/// `hasRubyAcceptedPaginateTrailingComma(markup)`
pub fn has_ruby_accepted_paginate_trailing_comma(m: &Scan) -> bool {
    let Some(tokens) = tokens_before_single_terminal_comma(m) else {
        return false;
    };
    let mut parser = markup_parser_for_tokens(tokens, m.markup);
    let parsed = (|| {
        parser.value_expression()?;
        if !parser.id("by") {
            return Ok(false);
        }
        parser.value_expression()?;
        if parser.consume_optional(T::Comma).is_some() {
            parser.named_arguments()?;
        }
        Ok::<_, ParseError>(true)
    })();
    parsed.unwrap_or(false) && parser.is_at_end()
}

/// `hasRubyAcceptedEmptyFirstFilterArgument(markup)`
pub fn has_ruby_accepted_empty_first_filter_argument(m: &Scan) -> bool {
    has_ruby_accepted_empty_first_filter_argument_with_tokens(&m.tokens, m.markup)
        && !has_skipped_characters(m)
}

/// `hasRubyAcceptedFilterArgumentTrailingComma(markup)`
pub fn has_ruby_accepted_filter_argument_trailing_comma(m: &Scan) -> bool {
    let Some(tokens) = remove_filter_argument_trailing_commas(&m.tokens) else {
        return false;
    };
    if has_skipped_characters(m) {
        return false;
    }
    parses_complete_liquid_variable(&tokens, m.markup)
        || parses_complete_assign_with_liquid_variable(&tokens, m.markup)
        || has_ruby_accepted_empty_first_filter_argument_with_tokens(&tokens, m.markup)
}

fn remove_filter_argument_trailing_commas<'a>(
    tokens: &[MarkupToken<'a>],
) -> Option<Vec<MarkupToken<'a>>> {
    let is_trailing_comma = |i: usize| {
        tokens[i].kind == T::Comma && tokens.get(i + 1).map_or(true, |next| next.kind == T::Pipe)
    };
    // Nothing to remove means `changed` stays false: skip the copy.
    if !(0..tokens.len()).any(is_trailing_comma) {
        return None;
    }

    let mut result: Vec<MarkupToken<'a>> = Vec::with_capacity(tokens.len());
    for (index, &token) in tokens.iter().enumerate() {
        if is_trailing_comma(index) {
            let since_pipe = result
                .iter()
                .rposition(|t| t.kind == T::Pipe)
                .map_or(0, |i| i + 1);
            if !result[since_pipe..].iter().any(|t| t.kind == T::Colon) {
                return None;
            }
            match result.last() {
                None => return None,
                Some(prev) if matches!(prev.kind, T::Comma | T::Colon | T::Pipe) => return None,
                _ => {}
            }
            continue;
        }
        result.push(token);
    }
    Some(result)
}

fn has_ruby_accepted_empty_first_filter_argument_with_tokens(
    tokens: &[MarkupToken],
    markup: &str,
) -> bool {
    let n = tokens.len();
    if n < 3
        || tokens[n - 3].kind != T::Pipe
        || tokens[n - 2].kind != T::Id
        || tokens[n - 1].kind != T::Colon
    {
        return false;
    }
    let prefix = &tokens[..n - 3];
    parses_complete_liquid_variable(prefix, markup)
        || parses_complete_assign_with_liquid_variable(prefix, markup)
}

fn parses_complete_liquid_variable(tokens: &[MarkupToken], source: &str) -> bool {
    let mut parser = markup_parser_for_tokens(tokens, source);
    parser.liquid_variable().is_ok() && parser.is_at_end()
}

fn parses_complete_assign_with_liquid_variable(tokens: &[MarkupToken], source: &str) -> bool {
    if tokens.len() < 3
        || tokens[0].kind != T::Id
        || tokens[1].kind != T::Equality
        || tokens[1].value != "="
    {
        return false;
    }
    parses_complete_liquid_variable(&tokens[2..], source)
}

/// `hasRubyAcceptedEmptyAssignRhs(markup)`
pub fn has_ruby_accepted_empty_assign_rhs(m: &Scan) -> bool {
    matches!(m.tokens.as_slice(), [a, b] if a.kind == T::Id && b.kind == T::Equality && b.value == "=")
        && !has_skipped_characters(m)
}

/// `hasRubyAcceptedAssignLhsExtraIdentifier(markup)`
pub fn has_ruby_accepted_assign_lhs_extra_identifier(m: &Scan) -> bool {
    let t = &m.tokens;
    if t.len() < 4
        || t[0].kind != T::Id
        || t[1].kind != T::Id
        || t[2].kind != T::Equality
        || t[2].value != "="
    {
        return false;
    }
    !has_skipped_characters(m) && parses_complete_value_expression(&t[3..], m.markup)
}

/// `hasRubyAcceptedIncludeMarkup(markup)`
pub fn has_ruby_accepted_include_markup(m: &Scan) -> bool {
    if has_skipped_characters(m) {
        return false;
    }
    let mut parser = markup_parser_for_tokens(&m.tokens, m.markup);
    let parsed = (|| {
        let snippet = parser.value_expression()?;
        if has_bare_array_access(&snippet) {
            return Ok(false);
        }
        if parser.id("for") || parser.id("with") {
            let binding = parser.value_expression()?;
            if has_bare_array_access(&binding) {
                return Ok(false);
            }
        }
        if parser.id("as") {
            parser.consume(T::Id)?;
        }
        parser.consume_optional(T::Comma);
        while parser.look(T::Id, 0) {
            parser.consume(T::Id)?;
            parser.consume(T::Colon)?;
            let value = parser.value_expression()?;
            if has_bare_array_access(&value) {
                return Ok(false);
            }
            if parser.consume_optional(T::Comma).is_none() {
                break;
            }
        }
        Ok::<_, ParseError>(true)
    })();
    parsed.unwrap_or(false) && parser.is_at_end()
}

/// `hasRubyAcceptedRawTagCloserWithMarkup(source, tagName, startIndex)`
pub fn has_ruby_accepted_raw_tag_closer_with_markup(
    source: &str,
    tag_name: &str,
    start_index: usize,
) -> bool {
    for tag in liquid_tag_bodies(source, start_index) {
        if let Some(markup) = liquid_tag_markup(tag.body) {
            if is_end_tag(markup.tag_name, tag_name)
                && markup.remaining_tokens > 0
                && !markup.has_skipped_characters
            {
                return has_balanced_raw_tag_remainder(source, tag_name, tag.end);
            }
        }
    }
    false
}

fn has_balanced_raw_tag_remainder(source: &str, tag_name: &str, start_index: usize) -> bool {
    let mut depth: i64 = 0;
    for tag in liquid_tag_bodies(source, start_index) {
        let Some(markup) = liquid_tag_markup(tag.body) else {
            continue;
        };
        if markup.has_skipped_characters {
            continue;
        }
        if markup.tag_name == tag_name {
            depth += 1;
            continue;
        }
        if is_end_tag(markup.tag_name, tag_name) {
            depth -= 1;
            if depth < 0 {
                return false;
            }
        }
    }
    depth == 0
}

/// `name === \`end${tagName}\``
pub fn is_end_tag(name: &str, tag_name: &str) -> bool {
    name.strip_prefix("end") == Some(tag_name)
}

/// `LiquidTagBody`
pub struct LiquidTagBody<'a> {
    pub start: usize,
    pub body: &'a str,
    pub body_start: usize,
    pub end: usize,
}

/// `liquidTagBodies(source, startIndex)`
pub fn liquid_tag_bodies(source: &str, start_index: usize) -> Vec<LiquidTagBody<'_>> {
    liquid_tag_bodies_in(source, &tokenize(source), start_index)
}

/// `liquidTagBodies` over tokens the caller already has for `source`.
pub fn liquid_tag_bodies_in<'a>(
    source: &'a str,
    tokens: &[Token],
    start_index: usize,
) -> Vec<LiquidTagBody<'a>> {
    let mut tags = Vec::new();
    for (i, open) in tokens.iter().enumerate() {
        if open.kind != TokenType::LiquidTagOpen || open.start < start_index {
            continue;
        }
        let text = tokens.get(i + 1).filter(|t| t.kind == TokenType::Text);
        let close = if text.is_some() {
            tokens.get(i + 2)
        } else {
            tokens.get(i + 1)
        };
        if !close.is_some_and(|c| c.kind == TokenType::LiquidTagClose) {
            continue;
        }
        tags.push(LiquidTagBody {
            start: open.start,
            body: text.map_or("", |t| &source[t.start..t.end]),
            body_start: text.map_or(open.end, |t| t.start),
            end: close.unwrap().end,
        });
    }
    tags
}

/// `LiquidTagMarkup` (`remainingTokens` is only ever counted).
pub struct LiquidTagMarkup<'a> {
    pub tag_name: &'a str,
    pub remaining_tokens: usize,
    pub has_skipped_characters: bool,
}

/// `liquidTagMarkup(body)`
pub fn liquid_tag_markup(body: &str) -> Option<LiquidTagMarkup<'_>> {
    let scan = Scan::new(body);
    let tag_name = scan.tokens.first().filter(|t| t.kind == T::Id)?;
    Some(LiquidTagMarkup {
        tag_name: tag_name.value,
        remaining_tokens: scan.tokens.len() - 1,
        has_skipped_characters: has_skipped_characters(&scan),
    })
}

/// `hasLiquidTagNamed(source, tagName)`
pub fn has_liquid_tag_named(source: &str, tag_name: &str) -> bool {
    liquid_tag_bodies(source, 0).iter().any(|tag| {
        liquid_tag_markup(tag.body)
            .is_some_and(|m| m.tag_name == tag_name && !m.has_skipped_characters)
    })
}

/// `liquidLineTagLocation(source, tagName)`
pub fn liquid_line_tag_location(source: &str, tag_name: &str) -> Option<(usize, usize)> {
    fn first_id(line: &str, start: usize) -> Option<MarkupToken<'_>> {
        tokenize_markup(line, start)
            .into_iter()
            .next()
            .filter(|t| t.kind == T::Id)
    }
    for tag in liquid_tag_bodies(source, 0) {
        let Some(first_line_end) = tag.body.find('\n') else {
            continue;
        };
        if !first_id(&tag.body[..first_line_end], tag.body_start)
            .is_some_and(|t| t.value == "liquid")
        {
            continue;
        }
        let mut line_start = tag.body_start;
        for line in tag.body.split('\n') {
            if let Some(first) = first_id(line, line_start).filter(|t| t.value == tag_name) {
                return Some((first.start, line_start + line.len()));
            }
            line_start += line.len() + 1;
        }
    }
    None
}

/// `hasSkippedPrefixCharacters(source, from, to)`
pub fn has_skipped_prefix_characters(source: &str, from: usize, to: usize) -> bool {
    Scan::new(js_slice(source, from, to))
        .uncovered(true)
        .next()
        .is_some()
}

/// `hasUnclosedQuotedString(markup)`
pub fn has_unclosed_quoted_string(m: &Scan) -> bool {
    m.uncovered(false).any(is_quote)
}

fn parses_complete_value_expression(tokens: &[MarkupToken], source: &str) -> bool {
    let mut parser = markup_parser_for_tokens(tokens, source);
    parser.value_expression().is_ok() && parser.is_at_end()
}

fn tokens_before_single_terminal_comma<'s, 'a>(m: &'s Scan<'a>) -> Option<&'s [MarkupToken<'a>]> {
    let t = &m.tokens;
    let n = t.len();
    if n < 2 || t[n - 1].kind != T::Comma || t[n - 2].kind == T::Comma || has_skipped_characters(m)
    {
        return None;
    }
    Some(&t[..n - 1])
}

fn markup_parser_for_tokens<'a>(tokens: &[MarkupToken<'a>], source: &'a str) -> MarkupParser<'a> {
    let mut all = Vec::with_capacity(tokens.len() + 1);
    all.extend_from_slice(tokens);
    all.push(MarkupToken {
        kind: T::EndOfString,
        value: "",
        start: source.len(),
        end: source.len(),
    });
    MarkupParser::new(all, source)
}

fn is_whitespace(c: char) -> bool {
    matches!(c, ' ' | '\n' | '\r' | '\t')
}

pub fn is_quote(c: char) -> bool {
    c == '\'' || c == '"'
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markup_coverage() {
        assert!(!has_skipped_characters(&Scan::new("foo, 'bar'")));
        assert!(has_skipped_characters(&Scan::new("@foo, 'bar'")));
        assert!(has_empty_markup(&Scan::new("  \n ")));
        assert!(!has_empty_markup(&Scan::new(" @ ")));
        assert!(has_unclosed_quoted_string(&Scan::new("x == 'a")));
        assert!(has_skipped_prefix_characters("@x", 0, 2));
        assert!(!has_skipped_prefix_characters("\"x", 0, 2));
        assert!(has_single_string_markup(&Scan::new(" 'scss' "), "scss"));
    }

    #[test]
    fn ruby_accepted_forms() {
        assert!(has_ruby_valid_inline_comment_markup(&Scan::new(
            " hello\n# world "
        )));
        assert!(!has_ruby_valid_inline_comment_markup(&Scan::new(
            " hello\nworld "
        )));
        assert!(has_ruby_valid_inline_comment_markup(&Scan::new("\nworld ")));
        assert!(has_ruby_accepted_cycle_trailing_comma(&Scan::new(
            "product.handle,"
        )));
        assert!(!has_ruby_accepted_cycle_trailing_comma(&Scan::new(
            "product.handle,,"
        )));
        assert!(has_ruby_accepted_loop_trailing_comma(&Scan::new(
            "product in products,"
        )));
        assert!(has_ruby_accepted_paginate_trailing_comma(&Scan::new(
            "products by 12,"
        )));
        assert!(has_ruby_accepted_empty_first_filter_argument(&Scan::new(
            "product.title | append:"
        )));
        assert!(!has_ruby_accepted_empty_first_filter_argument(&Scan::new(
            "product.title | append"
        )));
        assert!(has_ruby_accepted_filter_argument_trailing_comma(
            &Scan::new("n | f1: 1, 2, 3, | f2:")
        ));
        assert!(!has_ruby_accepted_filter_argument_trailing_comma(
            &Scan::new("n | f1: , | f2")
        ));
        assert!(has_ruby_accepted_empty_assign_rhs(&Scan::new("handle =")));
        assert!(has_ruby_accepted_assign_lhs_extra_identifier(&Scan::new(
            "handle extra = product"
        )));
        assert!(!has_ruby_accepted_assign_lhs_extra_identifier(&Scan::new(
            "handle 42 = product"
        )));
        assert!(has_ruby_accepted_include_markup(&Scan::new(
            "(1..5) for products as item"
        )));
        assert!(!has_ruby_accepted_include_markup(&Scan::new("?")));
    }

    #[test]
    fn tag_bodies() {
        let src = "{% raw %}{% endraw foo %}";
        let bodies: Vec<_> = liquid_tag_bodies(src, 0).iter().map(|t| t.body).collect();
        assert_eq!(bodies, vec![" raw ", " endraw foo "]);
        assert!(has_liquid_tag_named("{% doc %}", "doc"));
        assert!(!has_liquid_tag_named("{% docx %}", "doc"));
        let src = "{% liquid\n  block 'x'\n%}";
        assert_eq!(liquid_line_tag_location(src, "block"), Some((12, 21)));
        assert_eq!(get_offset("ab\ncd", 2, 2), 4);
        assert_eq!(get_offset("é\nx", 1, 2), 2);
    }
}
