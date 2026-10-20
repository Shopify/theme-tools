//! Port of `document/tokenizer.ts`, without its fast paths. Offsets are byte offsets.

use crate::raw_body::{find_raw_body_end, is_literal, rule_for, RawBodyEnd};
use crate::{find_ascii, first_word, is_js_space, js_trim_start};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenType {
    Text,
    LiquidTagOpen,
    LiquidTagClose,
    LiquidVariableOutputOpen,
    LiquidVariableOutputClose,
    HtmlTagOpen,
    HtmlCloseTagOpen,
    HtmlTagClose,
    HtmlSelfClose,
    HtmlCommentOpen,
    HtmlCommentClose,
    HtmlDoctypeOpen,
    HtmlEquals,
    HtmlQuoteOpen,
    HtmlQuoteClose,
    YamlFrontmatter,
    EndOfInput,
}

impl TokenType {
    pub fn as_str(self) -> &'static str {
        use TokenType::*;
        match self {
            Text => "Text",
            LiquidTagOpen => "LiquidTagOpen",
            LiquidTagClose => "LiquidTagClose",
            LiquidVariableOutputOpen => "LiquidVariableOutputOpen",
            LiquidVariableOutputClose => "LiquidVariableOutputClose",
            HtmlTagOpen => "HtmlTagOpen",
            HtmlCloseTagOpen => "HtmlCloseTagOpen",
            HtmlTagClose => "HtmlTagClose",
            HtmlSelfClose => "HtmlSelfClose",
            HtmlCommentOpen => "HtmlCommentOpen",
            HtmlCommentClose => "HtmlCommentClose",
            HtmlDoctypeOpen => "HtmlDoctypeOpen",
            HtmlEquals => "HtmlEquals",
            HtmlQuoteOpen => "HtmlQuoteOpen",
            HtmlQuoteClose => "HtmlQuoteClose",
            YamlFrontmatter => "YamlFrontmatter",
            EndOfInput => "EndOfInput",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenType,
    pub start: usize,
    pub end: usize,
}

impl Token {
    pub(crate) fn len(&self) -> usize {
        self.end - self.start
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    Default,
    HtmlTag,
    QuotedValue,
    LiquidTag,
    LiquidVariableOutput,
    RawText,
    HtmlComment,
}

/// Which Liquid raw tags' bodies the tokenizer bounds.
#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub(crate) enum RawTags {
    /// None: their bodies tokenize like any other markup.
    #[default]
    None,
    /// `builtinRawTags`: literal bodies are skipped, and every body's end is kept for the parser.
    Builtin,
    /// `rawTags` alone, as `tokenizeSlice` tokenizes.
    Slice,
}

#[derive(Clone, Copy, Default)]
pub(crate) struct TokenizeOptions {
    pub raw_tags: RawTags,
    pub parse_html: bool,
    /// The whole input is a `<script>` or `<style>` body.
    pub raw_text: bool,
    pub skip_frontmatter: bool,
}

/// `BUILTIN_RAW_OPEN`'s names, in its order.
const RAW_TAGS: &[&str] = &[
    "raw",
    "comment",
    "doc",
    "schema",
    "javascript",
    "stylesheet",
    "style",
];

/// The end of a raw tag's body, by the index of the tag's `LiquidTagClose`.
pub(crate) type RawBodyEnds = Vec<(usize, RawBodyEnd)>;

pub fn tokenize(source: &str) -> Vec<Token> {
    tokenize_with(source, TokenizeOptions::default()).0
}

pub(crate) fn tokenize_with(source: &str, options: TokenizeOptions) -> (Vec<Token>, RawBodyEnds) {
    let mut t = Tokenizer {
        source,
        b: source.as_bytes(),
        options,
        tokens: Vec::with_capacity(source.len() / 8 + 4),
        raw_body_ends: Vec::new(),
        mode: if options.raw_text {
            Mode::RawText
        } else {
            Mode::Default
        },
        mode_stack: Vec::new(),
        pos: 0,
        text_start: None,
        text_is_space: false,
        quote_char: '"',
        bound: source.len(),
        raw_bodies: Vec::new(),
        unresolved: Vec::new(),
        literal_body_end: None,
        comment_body_start: usize::MAX,
        liquid_tag_start: 0,
        inside_doctype: false,
        in_svg: 0,
        pending_element: None,
        raw_text_tag: "",
    };
    t.run();
    (t.tokens, t.raw_body_ends)
}

/// Curly quotes are directional pairs; straight quotes close on themselves.
fn closing_quote_for(open: char) -> char {
    match open {
        '“' => '”',
        '”' => '“',
        '‘' => '’',
        '’' => '‘',
        c => c,
    }
}

fn quote_at(b: &[u8], pos: usize) -> Option<char> {
    match b[pos] {
        b'"' => Some('"'),
        b'\'' => Some('\''),
        0xE2 if pos + 2 < b.len() && b[pos + 1] == 0x80 => match b[pos + 2] {
            0x9C => Some('“'),
            0x9D => Some('”'),
            0x98 => Some('‘'),
            0x99 => Some('’'),
            _ => None,
        },
        _ => None,
    }
}

/// `[a-zA-Z{]`: what may follow `<` or `</` to open an HTML tag.
fn is_tag_name_start(c: Option<&u8>) -> bool {
    c.is_some_and(|c| c.is_ascii_alphabetic() || *c == b'{')
}

/// The raw tag a `{% … %}` at `at` opens, matched like `BUILTIN_RAW_OPEN`.
fn builtin_raw_name(source: &str, at: usize) -> Option<&'static str> {
    let at = at
        + if source.as_bytes().get(at + 2) == Some(&b'-') {
            3
        } else {
            2
        };
    let rest = js_trim_start(&source[at..]);
    RAW_TAGS.iter().copied().find(|name| {
        rest.strip_prefix(name).is_some_and(|after| {
            after.starts_with(is_js_space) || after.starts_with("%}") || after.starts_with("-%}")
        })
    })
}

/// A raw body tokenized up to its end tag, and the state to resume after it.
struct RawBody {
    tag_start: usize,
    mode: Mode,
    depth: usize,
    quote: char,
    raw_text_tag: &'static str,
}

struct Tokenizer<'a> {
    source: &'a str,
    b: &'a [u8],
    options: TokenizeOptions,
    tokens: Vec<Token>,
    raw_body_ends: RawBodyEnds,
    mode: Mode,
    mode_stack: Vec<Mode>,
    pos: usize,
    text_start: Option<usize>,
    /// Whether the pending Text run is whitespace. Only HtmlTag mode reads it.
    text_is_space: bool,
    quote_char: char,
    /// `lexicalSource.length`: where the innermost raw body ends, or the end of the source.
    bound: usize,
    raw_bodies: Vec<RawBody>,
    /// Raw tags whose bodies found no end, and the bound they searched to.
    unresolved: Vec<(&'static str, usize)>,
    literal_body_end: Option<usize>,
    /// Where the current comment's body starts, for the spec's empty comments `<!-->` and
    /// `<!--->`, which close only right after `<!--`.
    comment_body_start: usize,
    /// Where the `{%` of the Liquid tag being tokenized starts.
    liquid_tag_start: usize,
    inside_doctype: bool,
    in_svg: usize,
    /// The element whose open tag is being tokenized, when it is `svg`, `script` or `style`:
    /// the tag's `>` opens it.
    pending_element: Option<&'static str>,
    /// The `<script>` or `<style>` whose body is being tokenized in RawText mode, or "" for a
    /// `raw_text` input or a raw body (no close tag).
    raw_text_tag: &'static str,
}

impl Tokenizer<'_> {
    fn at(&self, s: &[u8]) -> bool {
        self.b[self.pos..self.bound].starts_with(s)
    }

    fn flush_text(&mut self) {
        if let Some(start) = self.text_start.take() {
            self.tokens.push(Token {
                kind: TokenType::Text,
                start,
                end: self.pos,
            });
        }
    }

    fn emit(&mut self, kind: TokenType, len: usize) {
        self.flush_text();
        self.tokens.push(Token {
            kind,
            start: self.pos,
            end: self.pos + len,
        });
        self.pos += len;
    }

    fn push_mode(&mut self, next: Mode) {
        self.mode_stack.push(self.mode);
        self.mode = next;
    }

    fn pop_mode(&mut self) {
        self.mode = self.mode_stack.pop().unwrap_or(Mode::Default);
    }

    fn start_text(&mut self) {
        self.text_start.get_or_insert(self.pos);
    }

    /// Past the character at `pos`.
    fn next_char(&self) -> usize {
        self.pos
            + match self.b[self.pos] {
                0..=0x7f => 1,
                0xc0..=0xdf => 2,
                0xe0..=0xef => 3,
                _ => 4,
            }
    }

    /// Extends the text run past the character at `pos`, up to the next byte that may start a
    /// token in this mode.
    fn text_until(&mut self, stop: impl Fn(u8) -> bool) {
        self.start_text();
        self.pos = self.next_char();
        while self.pos < self.bound && !stop(self.b[self.pos]) {
            self.pos += 1;
        }
    }

    /// Liquid bodies only end at `close`, or at the `-` right before it.
    fn text_until_close(&mut self, close: &str) {
        self.start_text();
        let from = self.next_char();
        self.pos = match find_ascii(&self.source[from..self.bound], close) {
            None => self.bound,
            Some(i) if i > 0 && self.b[from + i - 1] == b'-' => from + i - 1,
            Some(i) => from + i,
        };
    }

    /// `scanLiquidOpen`, at a `{`.
    fn scan_liquid_open(&mut self) -> bool {
        let next = self.b[..self.bound].get(self.pos + 1);
        let len = if self.b[..self.bound].get(self.pos + 2) == Some(&b'-') {
            3
        } else {
            2
        };
        match next {
            Some(b'{') => {
                self.emit(TokenType::LiquidVariableOutputOpen, len);
                self.push_mode(Mode::LiquidVariableOutput);
            }
            Some(b'%') => {
                self.liquid_tag_start = self.pos;
                self.emit(TokenType::LiquidTagOpen, len);
                self.push_mode(Mode::LiquidTag);
            }
            _ => return false,
        }
        true
    }

    /// `skipRawBody`: bounds the body of the raw tag that just closed, so markup in it can't open
    /// a mode that outlives it, and keeps its end for the parser.
    fn skip_raw_body(&mut self) {
        if self.options.raw_tags == RawTags::None
            || (self.inside_doctype && self.options.parse_html)
            || self.literal_body_end.is_some_and(|e| self.pos <= e)
        {
            return;
        }
        let name = if self.options.raw_tags == RawTags::Builtin {
            builtin_raw_name(self.source, self.liquid_tag_start)
        } else {
            let open = self.liquid_tag_start;
            let open_end = open + if self.b[open + 2] == b'-' { 3 } else { 2 };
            let close = self.tokens[self.tokens.len() - 1].start;
            let word = first_word(&self.source[open_end..close]);
            RAW_TAGS.iter().copied().find(|n| *n == word)
        };
        let Some(name) = name else { return };
        if self.unresolved.contains(&(name, self.bound)) {
            return;
        }
        let rule = rule_for(name).expect("raw tags have body rules");
        let Some(end) = find_raw_body_end(&self.source[..self.bound], self.pos, name, rule) else {
            self.unresolved.push((name, self.bound));
            return;
        };
        let literal = is_literal(name);
        if self.options.raw_tags == RawTags::Builtin {
            self.raw_body_ends.push((self.tokens.len() - 1, end));
            if literal {
                self.pos = end.tag_end;
                return;
            }
        }
        // Plain bodies and one unfinished output need no additional lexer mode.
        let first = (self.pos..self.b.len().saturating_sub(1))
            .find(|&i| self.b[i] == b'{' && matches!(self.b[i + 1], b'{' | b'%'));
        let first = match first {
            Some(f) if f + 2 <= end.tag_start => f,
            _ => {
                if self.pos < end.tag_start {
                    self.emit(TokenType::Text, end.tag_start - self.pos);
                }
                return;
            }
        };
        let body = &self.source[..end.tag_start];
        let open_end = first
            + if body.as_bytes().get(first + 2) == Some(&b'-') {
                3
            } else {
                2
            };
        if self.b[first + 1] == b'{' && find_ascii(&body[open_end..], "}}").is_none() {
            if self.pos < first {
                self.emit(TokenType::Text, first - self.pos);
            }
            self.emit(TokenType::LiquidVariableOutputOpen, open_end - first);
            if self.pos < end.tag_start {
                self.emit(TokenType::Text, end.tag_start - self.pos);
            }
            return;
        }
        self.raw_bodies.push(RawBody {
            tag_start: end.tag_start,
            mode: self.mode,
            depth: self.mode_stack.len(),
            quote: self.quote_char,
            raw_text_tag: self.raw_text_tag,
        });
        if literal {
            self.literal_body_end = Some(end.tag_start);
        }
        self.bound = end.tag_start;
        self.mode = Mode::RawText;
        self.raw_text_tag = "";
    }

    /// `resumeRawBody`: at the end of raw bodies, the mode before each holds again.
    fn resume_raw_body(&mut self) -> bool {
        while self.pos >= self.bound {
            let Some(body) = self.raw_bodies.pop() else {
                return false;
            };
            self.flush_text();
            self.mode = body.mode;
            self.mode_stack.truncate(body.depth);
            self.quote_char = body.quote;
            self.raw_text_tag = body.raw_text_tag;
            self.bound = self
                .raw_bodies
                .last()
                .map_or(self.source.len(), |p| p.tag_start);
        }
        true
    }

    /// The lowercase name at `at` when it is `svg`, `script` or `style` followed by whitespace,
    /// `/` or `>` (or the end), as the parser names those elements. An `<svg` glued to Liquid
    /// counts as an `<svg>`: in one, comments tokenize as plain tokens, so a wrong guess costs
    /// nothing.
    fn element_name_at(&self, at: usize) -> Option<&'static str> {
        let rest = &self.b[at..];
        let named =
            |n: &str| rest.len() >= n.len() && rest[..n.len()].eq_ignore_ascii_case(n.as_bytes());
        ["svg", "script", "style"]
            .into_iter()
            .find(|n| {
                named(n)
                    && self.source[at + n.len()..]
                        .chars()
                        .next()
                        .is_none_or(|c| c == '/' || c == '>' || is_js_space(c))
            })
            .or_else(|| (named("svg") && rest.get(3) == Some(&b'{')).then_some("svg"))
    }

    /// Whether `</` at `at` begins a `</svg>` (whitespace allowed before `>`) within 64 UTF-16
    /// units, as `/^<\/svg\s*>/i` reads `source.slice(at, at + 64)`.
    fn closes_svg(&self, at: usize) -> bool {
        if !self.b[at..]
            .get(2..5)
            .is_some_and(|n| n.eq_ignore_ascii_case(b"svg"))
        {
            return false;
        }
        // Every JS space is one UTF-16 unit.
        let mut rest = self.source[at + 5..].chars().take(64 - 5);
        rest.find(|c| !is_js_space(*c)) == Some('>')
    }

    /// Whether `</` at `at` begins the close tag of the current raw text element: the whole
    /// `</script>`, whitespace allowed before `>`.
    fn closes_raw_text(&self, at: usize) -> bool {
        let name = self.raw_text_tag;
        if name.is_empty()
            || !self.b[at + 2..]
                .get(..name.len())
                .is_some_and(|n| n.eq_ignore_ascii_case(name.as_bytes()))
        {
            return false;
        }
        js_trim_start(&self.source[at + 2 + name.len()..]).starts_with('>')
    }

    /// At the `>` of an open tag: an `<svg>` starts an SVG body, and a `<script>` or `<style>`
    /// outside SVG a raw text body (inside SVG it is foreign content, read as markup).
    fn open_pending_element(&mut self) {
        match self.pending_element.take() {
            Some("svg") => self.in_svg += 1,
            Some(element) if self.in_svg == 0 && self.mode == Mode::Default => {
                self.raw_text_tag = element;
                self.push_mode(Mode::RawText);
            }
            _ => {}
        }
    }

    fn run(&mut self) {
        let b = self.b;
        if !self.options.skip_frontmatter && (self.at(b"---\n") || self.at(b"---\r\n")) {
            let search_start = self.source.find('\n').map_or(0, |i| i + 1);
            if let Some(close) = find_ascii(&self.source[search_start..], "\n---") {
                let mut end = search_start + close + 4;
                if b.get(end) == Some(&b'\r') {
                    end += 1;
                }
                if b.get(end) == Some(&b'\n') {
                    end += 1;
                }
                self.tokens.push(Token {
                    kind: TokenType::YamlFrontmatter,
                    start: 0,
                    end,
                });
                self.pos = end;
            }
        }

        while self.pos < self.bound || self.resume_raw_body() {
            let c = b[self.pos];
            match self.mode {
                Mode::LiquidTag => {
                    let len = if self.at(b"-%}") {
                        3
                    } else if self.at(b"%}") {
                        2
                    } else {
                        self.text_until_close("%}");
                        continue;
                    };
                    self.emit(TokenType::LiquidTagClose, len);
                    self.pop_mode();
                    self.skip_raw_body();
                }
                Mode::LiquidVariableOutput => {
                    let len = if self.at(b"-}}") {
                        3
                    } else if self.at(b"}}") {
                        2
                    } else {
                        self.text_until_close("}}");
                        continue;
                    };
                    self.emit(TokenType::LiquidVariableOutputClose, len);
                    self.pop_mode();
                }
                Mode::Default => {
                    if c == b'{' && self.scan_liquid_open() {
                        continue;
                    }
                    // Inside an `<svg>`, `<!--` and `-->` are one-off tokens that open no mode.
                    if c == b'<' && self.at(b"<!--") && self.in_svg > 0 {
                        self.emit(TokenType::HtmlCommentOpen, 4);
                    } else if c == b'-' && self.at(b"-->") && self.in_svg > 0 {
                        self.emit(TokenType::HtmlCommentClose, 3);
                    } else if c == b'<' && self.at(b"<!--") {
                        self.emit(TokenType::HtmlCommentOpen, 4);
                        self.push_mode(Mode::HtmlComment);
                        self.comment_body_start = self.pos;
                    } else if c == b'<' && self.at(b"<!") {
                        self.inside_doctype = true;
                        self.emit(TokenType::HtmlDoctypeOpen, 2);
                        self.push_mode(Mode::HtmlTag);
                    } else if c == b'<' && self.at(b"</") && is_tag_name_start(b.get(self.pos + 2))
                    {
                        if self.in_svg > 0 && self.closes_svg(self.pos) {
                            self.in_svg -= 1;
                        }
                        self.emit(TokenType::HtmlCloseTagOpen, 2);
                        self.push_mode(Mode::HtmlTag);
                    } else if c == b'<' && is_tag_name_start(b.get(self.pos + 1)) {
                        self.pending_element = self.element_name_at(self.pos + 1);
                        self.emit(TokenType::HtmlTagOpen, 1);
                        self.push_mode(Mode::HtmlTag);
                    } else {
                        self.text_until(|c| matches!(c, b'{' | b'<' | b'-'));
                    }
                }
                Mode::HtmlTag => {
                    if c == b'{' && self.scan_liquid_open() {
                        continue;
                    }
                    if self.at(b"/>") {
                        self.emit(TokenType::HtmlSelfClose, 2);
                        self.pop_mode();
                        self.pending_element = None;
                    } else if c == b'>' {
                        self.emit(TokenType::HtmlTagClose, 1);
                        self.pop_mode();
                        self.inside_doctype = false;
                        self.open_pending_element();
                    } else if c == b'=' {
                        self.emit(TokenType::HtmlEquals, 1);
                    } else if let Some(q) = quote_at(&b[..self.bound], self.pos) {
                        self.quote_char = q;
                        self.emit(TokenType::HtmlQuoteOpen, q.len_utf8());
                        self.push_mode(Mode::QuotedValue);
                    } else {
                        // A run of whitespace inside a tag is a Text token of its own.
                        let ch = self.source[self.pos..].chars().next().unwrap();
                        let is_space = is_js_space(ch);
                        if self.text_start.is_some() && is_space != self.text_is_space {
                            self.flush_text();
                        }
                        if self.text_start.is_none() {
                            self.text_is_space = is_space;
                        }
                        self.start_text();
                        self.pos += ch.len_utf8();
                    }
                }
                Mode::QuotedValue => {
                    if c == b'{' && self.scan_liquid_open() {
                        continue;
                    }
                    let quote = self.quote_char;
                    match quote_at(&b[..self.bound], self.pos) {
                        Some(q) if q == quote || q == closing_quote_for(quote) => {
                            self.emit(TokenType::HtmlQuoteClose, q.len_utf8());
                            self.pop_mode();
                        }
                        _ => self.text_until(|c| matches!(c, b'{' | b'"' | b'\'' | 0xE2)),
                    }
                }
                Mode::HtmlComment => {
                    // A comment's body is text, except for Liquid and the comment's close.
                    if c == b'{' && self.scan_liquid_open() {
                        continue;
                    }
                    // The HTML spec closes `<!-->` and `<!--->` as empty comments.
                    let len = if self.pos == self.comment_body_start && c == b'>' {
                        1
                    } else if self.pos == self.comment_body_start && self.at(b"->") {
                        2
                    } else if self.at(b"-->") {
                        3
                    } else if self.at(b"--!>") {
                        4
                    } else {
                        self.text_until(|c| matches!(c, b'{' | b'-'));
                        continue;
                    };
                    self.emit(TokenType::HtmlCommentClose, len);
                    self.pop_mode();
                }
                Mode::RawText => {
                    // A `<script>` or `<style>` body is text, except for Liquid and the
                    // element's close tag.
                    if c == b'{' && self.scan_liquid_open() {
                        continue;
                    }
                    if self.at(b"</") && self.closes_raw_text(self.pos) {
                        self.pop_mode();
                        self.raw_text_tag = "";
                        self.emit(TokenType::HtmlCloseTagOpen, 2);
                        self.push_mode(Mode::HtmlTag);
                    } else {
                        self.text_until(|c| matches!(c, b'{' | b'<'));
                    }
                }
            }
        }

        self.flush_text();
        let len = self.source.len();
        self.tokens.push(Token {
            kind: TokenType::EndOfInput,
            start: len,
            end: len,
        });
    }
}

/// `tokenizeSlice`: tokens for `source[start..end]` as `ParserBase` re-tokenizes it, with offsets
/// in the whole source. Drops the slice's `EndOfInput` unless `with_end`.
pub(crate) fn tokenize_slice(
    source: &str,
    start: usize,
    end: usize,
    raw_text: bool,
    with_end: bool,
) -> Vec<Token> {
    let options = TokenizeOptions {
        raw_tags: RawTags::Slice,
        parse_html: true,
        raw_text,
        skip_frontmatter: true,
    };
    let (mut tokens, _) = tokenize_with(&source[start..end], options);
    if !with_end {
        tokens.pop();
    }
    for t in &mut tokens {
        t.start += start;
        t.end += start;
    }
    tokens
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(s: &str) -> Vec<(TokenType, &str)> {
        tokenize(s)
            .into_iter()
            .map(|t| (t.kind, &s[t.start..t.end]))
            .collect()
    }

    #[test]
    fn tokenizes_tags_and_curly_quotes() {
        use TokenType::*;
        assert_eq!(
            kinds("<a  b=“x y”>{{- z }}"),
            vec![
                (HtmlTagOpen, "<"),
                (Text, "a"),
                (Text, "  "),
                (Text, "b"),
                (HtmlEquals, "="),
                (HtmlQuoteOpen, "“"),
                (Text, "x y"),
                (HtmlQuoteClose, "”"),
                (HtmlTagClose, ">"),
                (LiquidVariableOutputOpen, "{{-"),
                (Text, " z "),
                (LiquidVariableOutputClose, "}}"),
                (EndOfInput, ""),
            ]
        );
    }
}
