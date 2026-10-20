//! Rust port of `@shopify/liquid-html-parser`: `toLiquidHtmlAST` and `toLiquidAST` with their
//! default options (strict parsing; the TS tolerant/lax paths are unreachable from them).
//!
//! Positions in the AST are UTF-8 byte offsets. Error `loc` columns are UTF-16 based, like TS.

pub use liquid_ast as ast;
use liquid_ast::Document;

mod html;
mod lines;
mod liquid_doc;
mod markup;
mod parser;
mod tags;
mod tokenizer;

pub use markup::{tokenize_markup, MarkupParser, MarkupToken, MarkupTokenType};
pub use tags::{BUILTIN_TAGS, LOOP_NAMED_TAGS};
pub use tokenizer::{tokenize, Token, TokenType};

/// The deepest the parsers nest: Liquid blocks and HTML elements, `{% liquid %}` blocks, and
/// markup brackets, ranges and `and`/`or` terms. Deeper input fails as if TS overflowed its stack,
/// where it gives up at about 976 `{% if %}`s, 1952 `<div>`s, 1000–3000 brackets or 10k–30k `or`
/// terms.
// ponytail: one limit for all, so 1000+ `or` terms fail here and not in TS. Count terms on their
// own if real themes have them.
pub const MAX_DEPTH: usize = 1000;

/// Levels of nesting parsed on one stack, about 64 KB of it in a release build (1 MB in debug).
const LEVELS_PER_STACK: usize = 32;

/// `f` at `depth` levels of nesting. Every [`LEVELS_PER_STACK`] levels, it runs on a thread of its
/// own, so parsing deep templates doesn't overflow the caller's stack.
// ponytail: needs threads, so not wasm32-unknown-unknown. `stacker::maybe_grow` if it must run there.
pub(crate) fn grow_stack<T: Send>(depth: usize, f: impl FnOnce() -> T + Send) -> T {
    if depth % LEVELS_PER_STACK != 0 {
        return f();
    }
    std::thread::scope(|s| {
        std::thread::Builder::new()
            .stack_size(8 << 20)
            .spawn_scoped(s, f)
            .expect("spawn parser thread")
            .join()
            .unwrap_or_else(|e| std::panic::resume_unwind(e))
    })
}

/// Keys of TS `LiquidLiteralValues`.
pub const LIQUID_LITERAL_KEYWORDS: &[&str] = &["nil", "null", "true", "false", "blank", "empty"];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LineColumn {
    /// 1-based.
    pub line: usize,
    /// 1-based, counted in UTF-16 code units (what TS reports).
    pub column: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Loc {
    pub start: LineColumn,
    pub end: LineColumn,
}

/// Mirrors `LiquidHTMLASTParsingError` (`name == "LiquidHTMLParsingError"`, `loc` set; TS's
/// `unclosed` is always null on these code paths). A few malformed inputs make TS throw a plain
/// `Error` instead (`name == "Error"`, no `loc`), e.g. `{% constructor %}`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParseError {
    pub name: &'static str,
    pub message: String,
    /// Byte offsets passed to the TS constructor (before its clamping).
    pub start: usize,
    pub end: usize,
    pub loc: Option<Loc>,
}

impl ParseError {
    pub(crate) fn liquid(message: String, start: usize, end: usize) -> Self {
        ParseError {
            name: "LiquidHTMLParsingError",
            message,
            start,
            end,
            loc: None,
        }
    }

    pub(crate) fn plain(message: String) -> Self {
        ParseError {
            name: "Error",
            message,
            start: 0,
            end: 0,
            loc: None,
        }
    }

    /// TS overflowing its stack.
    pub(crate) fn too_deep() -> Self {
        ParseError {
            name: "RangeError",
            ..Self::plain("Maximum call stack size exceeded".into())
        }
    }

    fn with_loc(mut self, source: &str) -> Self {
        if self.name == "LiquidHTMLParsingError" {
            self.loc = Some(Loc {
                start: line_column(source, self.start),
                end: line_column(source, self.end),
            });
        }
        self
    }
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.name, self.message)
    }
}

impl std::error::Error for ParseError {}

/// The `line-column` package on a UTF-16 index clamped to `[0, len - 1]`; `1:1` for "".
fn line_column(source: &str, byte: usize) -> LineColumn {
    let byte = byte.min(source.len());
    let len16 = source.encode_utf16().count();
    if len16 == 0 {
        return LineColumn { line: 1, column: 1 };
    }
    let target = source[..byte].encode_utf16().count().min(len16 - 1);
    let (mut line, mut line_start, mut i) = (1, 0, 0);
    for c in source.chars() {
        if i >= target {
            break;
        }
        i += c.len_utf16();
        if c == '\n' {
            line += 1;
            line_start = i;
        }
    }
    LineColumn {
        line,
        column: target - line_start + 1,
    }
}

pub fn to_liquid_html_ast(source: &str) -> Result<Document<'_>, ParseError> {
    parser::parse_document(source, true, false).map_err(|e| e.with_loc(source))
}

pub fn to_liquid_ast(source: &str) -> Result<Document<'_>, ParseError> {
    parser::parse_document(source, false, true).map_err(|e| e.with_loc(source))
}

/// JS `\s` / `String.prototype.trim` whitespace.
pub(crate) fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

pub(crate) fn js_trim(s: &str) -> &str {
    js_trim_end(js_trim_start(s))
}

fn is_ascii_js_space(c: u8) -> bool {
    matches!(c, b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c)
}

// Byte loops for the ASCII whitespace; the char-based trim only runs on a non-ASCII edge.
pub(crate) fn js_trim_start(s: &str) -> &str {
    let s = &s[s
        .bytes()
        .position(|c| !is_ascii_js_space(c))
        .unwrap_or(s.len())..];
    if s.as_bytes().first().is_some_and(|c| *c >= 0x80) {
        s.trim_start_matches(is_js_space)
    } else {
        s
    }
}

pub(crate) fn js_trim_end(s: &str) -> &str {
    let s = &s[..s
        .bytes()
        .rposition(|c| !is_ascii_js_space(c))
        .map_or(0, |i| i + 1)];
    if s.as_bytes().last().is_some_and(|c| *c >= 0x80) {
        s.trim_end_matches(is_js_space)
    } else {
        s
    }
}

/// `s.search(/\s/)`
pub(crate) fn js_find_space(s: &str) -> Option<usize> {
    let i = s.bytes().position(|c| is_ascii_js_space(c) || c >= 0x80)?;
    if is_ascii_js_space(s.as_bytes()[i]) {
        Some(i)
    } else {
        s[i..].find(is_js_space).map(|j| i + j)
    }
}

pub(crate) fn starts_with_js_space(s: &str) -> bool {
    s.chars().next().is_some_and(is_js_space)
}

/// `s.indexOf(pat)` for an ASCII `pat`: memchr on its first byte, which beats the generic
/// substring searcher on these short patterns.
pub(crate) fn find_ascii(s: &str, pat: &str) -> Option<usize> {
    let (first, b) = (pat.as_bytes()[0] as char, s.as_bytes());
    let mut i = 0;
    while let Some(j) = s[i..].find(first) {
        if b[i + j..].starts_with(pat.as_bytes()) {
            return Some(i + j);
        }
        i += j + 1;
    }
    None
}

/// `/\{[{%]/.test(s)`
pub(crate) fn has_liquid_open(s: &str) -> bool {
    find_ascii(s, "{{").is_some() || find_ascii(s, "{%").is_some()
}

/// The first word of a tag body: `trimmed.slice(0, trimmed.search(/\s/))` after `trimStart`.
pub(crate) fn first_word(s: &str) -> &str {
    let t = js_trim_start(s);
    match js_find_space(t) {
        Some(i) => &t[..i],
        None => t,
    }
}

/// JS `toLowerCase() === lower` where `lower` is already lowercase.
pub(crate) fn js_lower_eq(s: &str, lower: &str) -> bool {
    if s.is_ascii() {
        s.eq_ignore_ascii_case(lower)
    } else {
        s.to_lowercase() == lower
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_whitespace_helpers() {
        assert_eq!(js_trim("\u{a0} \tx\u{2028}y \u{3000}\n"), "x\u{2028}y");
        assert_eq!(js_trim(" \u{feff} "), "");
        assert_eq!(js_find_space("é\u{2009}x y"), Some(2));
        assert_eq!(js_find_space("éx"), None);
    }

    #[test]
    fn fails_past_max_depth_without_overflowing() {
        let n = MAX_DEPTH;
        let ifs = |n| "{% if a %}".repeat(n) + &"{% endif %}".repeat(n);
        let markup_is_str =
            |source: &str| match to_liquid_html_ast(source).unwrap().children.remove(0) {
                ast::Node::LiquidTag(t) => matches!(t.markup, ast::Markup::Str(_)),
                ast::Node::LiquidVariableOutput(o) => matches!(o.markup, ast::Markup::Str(_)),
                node => panic!("{node:?}"),
            };
        // On the test thread's 2 MB stack: the parser starts threads of its own as it goes deeper.
        assert!(to_liquid_html_ast(&ifs(n)).is_ok());
        let e = to_liquid_html_ast(&ifs(n + 1)).unwrap_err();
        assert_eq!(
            e.to_string(),
            "RangeError: Maximum call stack size exceeded"
        );
        let divs = "<div>".repeat(2 * n) + &"</div>".repeat(2 * n);
        assert_eq!(to_liquid_html_ast(&divs).unwrap_err(), e);
        // Too-deep markup is a string, like markup that doesn't parse.
        for source in [
            format!("{{{{ x{}{} }}}}", "[a".repeat(n + 1), "]".repeat(n + 1)),
            format!("{{% if a{} %}}{{% endif %}}", " or a".repeat(n + 1)),
            format!(
                "{{% liquid\n{}{}%}}",
                "if a\n".repeat(n + 1),
                "endif\n".repeat(n + 1)
            ),
        ] {
            assert!(markup_is_str(&source), "{source}");
        }
    }

    #[test]
    fn parses_stray_liquid_in_raw_tags_in_linear_time() {
        // A stray `{{` in a raw tag's body runs past its end tag, so the parser re-tokenizes from
        // there. Re-tokenizing the whole rest of the document each time took 100 to 200 times as
        // long as a plain document of the same size.
        let time = |source: &str| {
            let start = std::time::Instant::now();
            assert!(to_liquid_html_ast(source).is_ok());
            start.elapsed()
        };
        let (n, raw) = (3000, "{% raw %}{{ x{% endraw %}");
        let attr = format!("<a href=\"{raw}\">{raw}</a>");
        let tail = "}}".to_string() + &"<a>b</a>".repeat(3 * n);
        for stray in [raw.repeat(n), raw.repeat(n) + &tail, attr.repeat(n) + &tail] {
            let plain = time(&"<a>b</a>".repeat(stray.len() / 8));
            assert!(time(&stray) < 20 * plain, "{}", &stray[..60]);
        }
    }
}
