//! Port of `src/document/tokenizer.ts`.
//!
//! Token offsets are UTF-8 byte offsets into the source. Callers convert them
//! to UTF-16 with `offsets::Utf16Offsets` when they are emitted to JS.
//!
//! The TS tokenizer steps one UTF-16 code unit at a time, and this one steps
//! one character at a time. Every pattern it matches is a single code unit, so
//! no token boundary can fall inside a character, and the two agree.

use crate::js::{js_is_ascii_alpha, js_is_whitespace, js_unit_eq};

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
        match self {
            TokenType::Text => "Text",
            TokenType::LiquidTagOpen => "LiquidTagOpen",
            TokenType::LiquidTagClose => "LiquidTagClose",
            TokenType::LiquidVariableOutputOpen => "LiquidVariableOutputOpen",
            TokenType::LiquidVariableOutputClose => "LiquidVariableOutputClose",
            TokenType::HtmlTagOpen => "HtmlTagOpen",
            TokenType::HtmlCloseTagOpen => "HtmlCloseTagOpen",
            TokenType::HtmlTagClose => "HtmlTagClose",
            TokenType::HtmlSelfClose => "HtmlSelfClose",
            TokenType::HtmlCommentOpen => "HtmlCommentOpen",
            TokenType::HtmlCommentClose => "HtmlCommentClose",
            TokenType::HtmlDoctypeOpen => "HtmlDoctypeOpen",
            TokenType::HtmlEquals => "HtmlEquals",
            TokenType::HtmlQuoteOpen => "HtmlQuoteOpen",
            TokenType::HtmlQuoteClose => "HtmlQuoteClose",
            TokenType::YamlFrontmatter => "YamlFrontmatter",
            TokenType::EndOfInput => "EndOfInput",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenType,
    pub start: usize,
    pub end: usize,
}

#[derive(Clone, Debug, Default)]
pub struct TokenizeOptions {
    pub skip_frontmatter: bool,
    /// The quote that opened the enclosing attribute value. `None` and an
    /// empty string both mean "not inside one", as both are falsy in TS.
    pub inside_quoted_attribute: Option<String>,
    pub inside_html_tag: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Mode {
    Default,
    HtmlTag,
    QuotedValue,
    LiquidTag,
    LiquidVariableOutput,
}

pub fn tokenize(source: &str, options: &TokenizeOptions) -> Vec<Token> {
    let mut tokenizer = Tokenizer::new(source, options);
    tokenizer.frontmatter(options);
    while tokenizer.pos < source.len() {
        tokenizer.step();
    }
    tokenizer.flush_text();
    tokenizer.tokens.push(Token {
        kind: TokenType::EndOfInput,
        start: source.len(),
        end: source.len(),
    });
    tokenizer.tokens
}

struct Tokenizer<'a> {
    source: &'a str,
    tokens: Vec<Token>,
    mode_stack: Vec<Mode>,
    mode: Mode,
    pos: usize,
    text_start: Option<usize>,
    /// Whether the pending Text run is whitespace. Only HtmlTag mode reads it.
    text_is_space: bool,
    quote_char: String,
}

impl<'a> Tokenizer<'a> {
    fn new(source: &'a str, options: &TokenizeOptions) -> Self {
        let mut tokenizer = Tokenizer {
            source,
            tokens: Vec::new(),
            mode_stack: Vec::new(),
            mode: Mode::Default,
            pos: 0,
            text_start: None,
            text_is_space: false,
            quote_char: String::new(),
        };
        let quote = options
            .inside_quoted_attribute
            .as_deref()
            .filter(|quote| !quote.is_empty());
        if let Some(quote) = quote {
            tokenizer.quote_char = quote.to_string();
            tokenizer.mode_stack.push(Mode::HtmlTag);
            tokenizer.mode = Mode::QuotedValue;
        } else if options.inside_html_tag {
            tokenizer.mode = Mode::HtmlTag;
        }
        tokenizer
    }

    /// The character at `pos + offset` bytes, or `None` past the end. Callers
    /// only pass an offset after ASCII characters, so it is a char boundary.
    fn ch(&self, offset: usize) -> Option<char> {
        self.source.get(self.pos + offset..)?.chars().next()
    }

    fn matches(&self, s: &str) -> bool {
        self.source.as_bytes()[self.pos..].starts_with(s.as_bytes())
    }

    fn flush_text(&mut self) {
        let Some(start) = self.text_start.take() else {
            return;
        };
        self.tokens.push(Token {
            kind: TokenType::Text,
            start,
            end: self.pos,
        });
    }

    fn emit(&mut self, kind: TokenType, length: usize) {
        self.flush_text();
        self.tokens.push(Token {
            kind,
            start: self.pos,
            end: self.pos + length,
        });
        self.pos += length;
    }

    fn push_mode(&mut self, next: Mode) {
        self.mode_stack.push(self.mode);
        self.mode = next;
    }

    fn pop_mode(&mut self) {
        self.mode = self.mode_stack.pop().unwrap_or(Mode::Default);
    }

    fn start_text(&mut self) {
        if self.text_start.is_none() {
            self.text_start = Some(self.pos);
        }
    }

    /// Adds the current character to the pending Text run.
    fn advance_text(&mut self) {
        self.start_text();
        self.pos += self.ch(0).map_or(1, char::len_utf8);
    }

    /// YAML frontmatter: only at position 0.
    fn frontmatter(&mut self, options: &TokenizeOptions) {
        if options.skip_frontmatter || !(self.matches("---\n") || self.matches("---\r\n")) {
            return;
        }
        let source = self.source;
        let search_start = source.find('\n').map_or(0, |i| i + 1);
        let Some(close) = source[search_start..].find("\n---") else {
            return;
        };
        let bytes = source.as_bytes();
        let mut end = search_start + close + 4;
        if end < bytes.len() && bytes[end] == b'\r' {
            end += 1;
        }
        if end < bytes.len() && bytes[end] == b'\n' {
            end += 1;
        }
        self.tokens.push(Token {
            kind: TokenType::YamlFrontmatter,
            start: 0,
            end,
        });
        self.pos = end;
    }

    /// Liquid open check, reused in Default, HtmlTag, and QuotedValue modes.
    fn scan_liquid_open(&mut self) -> bool {
        let (kind, length, mode) = if self.matches("{{-") {
            (
                TokenType::LiquidVariableOutputOpen,
                3,
                Mode::LiquidVariableOutput,
            )
        } else if self.matches("{{") {
            (
                TokenType::LiquidVariableOutputOpen,
                2,
                Mode::LiquidVariableOutput,
            )
        } else if self.matches("{%-") {
            (TokenType::LiquidTagOpen, 3, Mode::LiquidTag)
        } else if self.matches("{%") {
            (TokenType::LiquidTagOpen, 2, Mode::LiquidTag)
        } else {
            return false;
        };
        self.emit(kind, length);
        self.push_mode(mode);
        true
    }

    fn step(&mut self) {
        match self.mode {
            Mode::LiquidTag => self.step_liquid_close("-%}", "%}", TokenType::LiquidTagClose),
            Mode::LiquidVariableOutput => {
                self.step_liquid_close("-}}", "}}", TokenType::LiquidVariableOutputClose)
            }
            Mode::Default => self.step_default(),
            Mode::HtmlTag => self.step_html_tag(),
            Mode::QuotedValue => self.step_quoted_value(),
        }
    }

    fn step_liquid_close(&mut self, trimmed: &str, plain: &str, kind: TokenType) {
        if self.matches(trimmed) {
            self.emit(kind, 3);
            self.pop_mode();
        } else if self.matches(plain) {
            self.emit(kind, 2);
            self.pop_mode();
        } else {
            self.advance_text();
        }
    }

    fn step_default(&mut self) {
        if self.scan_liquid_open() {
            return;
        }
        if self.matches("<!--") {
            return self.emit(TokenType::HtmlCommentOpen, 4);
        }
        if self.matches("-->") {
            return self.emit(TokenType::HtmlCommentClose, 3);
        }
        if self.matches("<!") {
            self.emit(TokenType::HtmlDoctypeOpen, 2);
            return self.push_mode(Mode::HtmlTag);
        }
        if self.matches("</") && opens_tag_name(self.ch(2)) {
            self.emit(TokenType::HtmlCloseTagOpen, 2);
            return self.push_mode(Mode::HtmlTag);
        }
        if self.ch(0) == Some('<') && opens_tag_name(self.ch(1)) {
            self.emit(TokenType::HtmlTagOpen, 1);
            return self.push_mode(Mode::HtmlTag);
        }
        self.advance_text();
    }

    fn step_html_tag(&mut self) {
        if self.scan_liquid_open() {
            return;
        }
        if self.matches("/>") {
            self.emit(TokenType::HtmlSelfClose, 2);
            return self.pop_mode();
        }
        let current = self.ch(0);
        if current == Some('>') {
            self.emit(TokenType::HtmlTagClose, 1);
            return self.pop_mode();
        }
        if current == Some('=') {
            return self.emit(TokenType::HtmlEquals, 1);
        }
        // Straight and curly (smart) quotes both open an attribute value.
        if let Some(quote) = current.filter(|&c| matches!(c, '"' | '\'' | '“' | '”' | '‘' | '’'))
        {
            self.quote_char = quote.to_string();
            self.emit(TokenType::HtmlQuoteOpen, quote.len_utf8());
            return self.push_mode(Mode::QuotedValue);
        }
        // A run of whitespace inside a tag is a Text token of its own.
        let is_space = current.is_some_and(js_is_whitespace);
        if self.text_start.is_some() && is_space != self.text_is_space {
            self.flush_text();
        }
        if self.text_start.is_none() {
            self.text_is_space = is_space;
        }
        self.advance_text();
    }

    fn step_quoted_value(&mut self) {
        if self.scan_liquid_open() {
            return;
        }
        let closes = self.ch(0).is_some_and(|c| {
            js_unit_eq(c, closing_quote_for(&self.quote_char)) || js_unit_eq(c, &self.quote_char)
        });
        if !closes {
            return self.advance_text();
        }
        let length = self.ch(0).map_or(1, char::len_utf8);
        self.emit(TokenType::HtmlQuoteClose, length);
        self.pop_mode();
    }
}

/// JS `/[a-zA-Z]/.test(after) || after === '{'`.
fn opens_tag_name(after: Option<char>) -> bool {
    after.is_some_and(|c| js_is_ascii_alpha(c) || c == '{')
}

/// Curly quotes are directional, so a value opened with a left curly quote
/// closes on its right partner and vice versa. Straight quotes close on
/// themselves.
fn closing_quote_for(open: &str) -> &str {
    match open {
        "“" => "”",
        "”" => "“",
        "‘" => "’",
        "’" => "‘",
        _ => open,
    }
}
