//! Port of `src/document/liquid-raw.ts`.

use crate::ast::RawMarkupKinds;
use crate::document::factories::{
    DelimiterWhitespace, LiquidTagEnvelope, make_liquid_raw_tag, make_raw_markup, make_text_node,
};
use crate::document::liquid_tags::parse_liquid_tag;
use crate::document::liquid_variable_output::parse_liquid_variable_output;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::{Token, TokenType};
use crate::document::tree_builder::{ChildFilterMode, filter_children};
use crate::errors::ParseError;
use crate::js::{js_is_whitespace, js_is_word};
use crate::liquid_doc::parser::parse_liquid_doc;
use crate::value::JsVal;

// rawTag := "{%" tagName markup "%}" rawBody "{%" "end" tagName "%}"
pub fn parse_raw_tag(
    parser: &mut DocumentParser<'_>,
    parse_liquid_in_body: Option<bool>,
    envelope: &LiquidTagEnvelope,
    close_token: Token,
) -> Result<JsVal, ParseError> {
    let tag_name = envelope.tag_name.as_str();
    let end_tag_name = format!("end{tag_name}");

    let Some(end_tag) = scan_for_end_tag(parser, &end_tag_name) else {
        return Err(ParseError::parsing(
            format!("Attempting to end parsing before LiquidRawTag '{tag_name}' was closed"),
            envelope.block_start_position.get("start").offset(),
            envelope.block_start_position.get("end").offset(),
        ));
    };

    let source = parser.source;
    let body_start = close_token.end;
    let body_end = end_tag.tag_start;
    let body_string = &source[body_start..body_end];

    let body_nodes =
        parse_raw_tag_body(parser, parse_liquid_in_body, tag_name, body_start, body_end)?;

    let body = make_raw_markup(
        raw_markup_kind_for_tag(tag_name, body_string),
        body_string,
        body_nodes,
        body_start,
        body_end,
    );

    // Re-tokenize from exactly the end tag's end offset, so a token that a
    // stray `{{`/`{%` in the body ran past the end tag cannot swallow the
    // content after it.
    parser.reslice_tokens_from(end_tag.tag_end);

    let end_position = JsVal::position(end_tag.tag_start, end_tag.tag_end);

    Ok(make_liquid_raw_tag(
        envelope,
        source,
        body,
        end_position,
        DelimiterWhitespace {
            start: end_tag.ws_start,
            end: end_tag.ws_end,
        },
    ))
}

/// The close token type for a `{{` or `{%` open.
fn close_type_for(open: TokenType) -> TokenType {
    if open == TokenType::LiquidVariableOutputOpen {
        TokenType::LiquidVariableOutputClose
    } else {
        TokenType::LiquidTagClose
    }
}

/// Whether the construct opened at token `i` closes at or before `body_end`.
fn closes_within_body(parser: &DocumentParser<'_>, i: usize, body_end: usize) -> bool {
    let close_type = close_type_for(parser.token_at(i).kind);
    let count = parser.token_count();
    let mut j = i + 1;
    while j < count && parser.token_at(j).kind != close_type {
        j += 1;
    }
    j < count && parser.token_at(j).end <= body_end
}

// liquidInRange := (text | liquidVariableOutput | liquidTag)*
pub fn parse_liquid_in_range(
    parser: &mut DocumentParser<'_>,
    _body_start: usize,
    body_end: usize,
) -> Result<Vec<JsVal>, ParseError> {
    let mut nodes = Vec::new();
    let source = parser.source;

    // Raw bodies do not parse HTML. TS restores the flag only on success.
    let saved_parse_html = parser.parse_html;
    parser.parse_html = false;

    // The body bound is the stable source offset `body_end`, not a cached
    // token index: a nested raw tag can reslice the tokens.
    let mut i = parser.get_position();
    while i < parser.token_count() && parser.token_at(i).start < body_end {
        let token = parser.token_at(i);

        if token.kind == TokenType::LiquidVariableOutputOpen
            || token.kind == TokenType::LiquidTagOpen
        {
            // A construct that does not close within the body is literal text,
            // so `body.nodes` matches the bounded `body.value`.
            if !closes_within_body(parser, i, body_end) {
                nodes.push(make_text_node(
                    &source[token.start..body_end],
                    token.start,
                    body_end,
                ));
                while i < parser.token_count() && parser.token_at(i).start < body_end {
                    i += 1;
                }
                break;
            }

            parser.set_position(i);
            let node = if token.kind == TokenType::LiquidVariableOutputOpen {
                parse_liquid_variable_output(parser)?
            } else {
                parse_liquid_tag(parser)?
            };
            nodes.push(node);
            i = parser.get_position();
            continue;
        }

        nodes.push(make_text_node(
            &source[token.start..token.end],
            token.start,
            token.end,
        ));
        i += 1;
    }

    parser.parse_html = saved_parse_html;
    parser.set_position(i);
    Ok(filter_children(ChildFilterMode::Syntactic, nodes, source))
}

// rawBody := liquidDoc | (text | liquidVariableOutput | liquidTag)* | ""
pub fn parse_raw_tag_body(
    parser: &mut DocumentParser<'_>,
    parse_liquid_in_body: Option<bool>,
    tag_name: &str,
    body_start: usize,
    body_end: usize,
) -> Result<Vec<JsVal>, ParseError> {
    let source = parser.source;
    if tag_name == "doc" {
        return parse_liquid_doc(&source[body_start..body_end], body_start, source);
    }

    if parse_liquid_in_body == Some(true) {
        return parse_liquid_in_range(parser, body_start, body_end);
    }

    if body_start >= body_end {
        return Ok(Vec::new());
    }

    let text_node = make_text_node(&source[body_start..body_end], body_start, body_end);
    Ok(filter_children(
        ChildFilterMode::Syntactic,
        vec![text_node],
        source,
    ))
}

/// TS `EndTagScanResult`: where a raw tag's end tag sits in the source.
pub struct EndTagScanResult {
    /// Source offset where the end tag starts (the `{`).
    pub tag_start: usize,
    /// Source offset where the end tag ends (after `%}`).
    pub tag_end: usize,
    pub ws_start: &'static str,
    pub ws_end: &'static str,
}

/// One match of `\{%(-?)\s*(NAME)<boundary>\s*(-?)%\}` at `start`, trying
/// each of `names` in order, as a JS alternation does. With
/// `word_boundary`, the name must be followed by a char that fails
/// `js_is_word`, which is JS `\b` after a word char. Returns the index of the
/// matched name and the match.
fn match_liquid_tag_at(
    source: &str,
    start: usize,
    names: &[&str],
    word_boundary: bool,
) -> Option<(usize, EndTagScanResult)> {
    let rest = source[start..].strip_prefix("{%")?;
    let (ws_start, rest) = match rest.strip_prefix('-') {
        Some(rest) => ("-", rest),
        None => ("", rest),
    };
    let rest = rest.trim_start_matches(js_is_whitespace);
    names.iter().enumerate().find_map(|(index, name)| {
        let after_name = rest.strip_prefix(name)?;
        if word_boundary && after_name.chars().next().is_some_and(js_is_word) {
            return None;
        }
        let after_ws = after_name.trim_start_matches(js_is_whitespace);
        let (ws_end, after_dash) = match after_ws.strip_prefix('-') {
            Some(after_dash) => ("-", after_dash),
            None => ("", after_ws),
        };
        let after_close = after_dash.strip_prefix("%}")?;
        let tag_end = source.len() - after_close.len();
        let result = EndTagScanResult {
            tag_start: start,
            tag_end,
            ws_start,
            ws_end,
        };
        Some((index, result))
    })
}

/// The offset of the next `{%` at or after `from`.
fn next_tag_open(source: &str, from: usize) -> Option<usize> {
    source[from..].find("{%").map(|found| from + found)
}

pub fn scan_for_end_tag(
    parser: &DocumentParser<'_>,
    end_tag_name: &str,
) -> Option<EndTagScanResult> {
    let source = parser.source;
    let search_start = parser.token_at(parser.get_position()).start;

    // `comment` and `doc` bodies balance nested opens of the same tag before
    // matching their end tag. `raw` and every other raw tag keep first-match
    // semantics.
    if end_tag_name == "endcomment" || end_tag_name == "enddoc" {
        return scan_for_balanced_end_tag(source, search_start, end_tag_name);
    }

    // JS `new RegExp(`\\{%(-?)\\s*${endTagName}\\s*(-?)%\\}`).exec(source.slice(searchStart))`
    let mut cursor = search_start;
    while let Some(open) = next_tag_open(source, cursor) {
        if let Some((_, result)) = match_liquid_tag_at(source, open, &[end_tag_name], false) {
            return Some(result);
        }
        cursor = open + 1;
    }
    None
}

/// Depth-balancing end-tag scan for `comment`/`doc`. A nested open of the same
/// tag pairs with its own end tag, and a nested `raw`...`endraw` is carved out.
fn scan_for_balanced_end_tag(
    source: &str,
    search_start: usize,
    end_tag_name: &str,
) -> Option<EndTagScanResult> {
    let open_tag_name = &end_tag_name[3..]; // "endcomment" -> "comment"
    // JS `\{%(-?)\s*(${openTagName}|${endTagName}|raw|endraw)\b\s*(-?)%\}`, flag `g`
    let names = [open_tag_name, end_tag_name, "raw", "endraw"];

    let mut depth = 0;
    let mut in_raw = false;
    let mut cursor = search_start;
    while let Some(open) = next_tag_open(source, cursor) {
        let Some((index, result)) = match_liquid_tag_at(source, open, &names, true) else {
            cursor = open + 1;
            continue;
        };
        cursor = result.tag_end;
        let name = names[index];
        if in_raw {
            if name == "endraw" {
                in_raw = false;
            }
            continue;
        }
        if name == "raw" {
            in_raw = true;
        } else if name == open_tag_name {
            depth += 1;
        } else if name == end_tag_name {
            if depth == 0 {
                return Some(result);
            }
            depth -= 1;
        }
    }
    None
}

/// JS `/\{[{%]/.test(s)`.
pub fn has_liquid_open(s: &str) -> bool {
    s.contains("{{") || s.contains("{%")
}

pub fn raw_markup_kind_for_tag(tag_name: &str, body_source: &str) -> RawMarkupKinds {
    match tag_name {
        "javascript" => RawMarkupKinds::Javascript,
        "stylesheet" | "style" if has_liquid_open(body_source) => RawMarkupKinds::Text,
        "stylesheet" | "style" => RawMarkupKinds::Css,
        "schema" => RawMarkupKinds::Json,
        _ => RawMarkupKinds::Text,
    }
}
