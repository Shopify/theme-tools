//! Port of `document/tokenizer.ts`. Offsets are byte offsets.

use crate::is_js_space;

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
}

#[derive(Default)]
pub(crate) struct TokenizeOptions {
    pub skip_frontmatter: bool,
    pub inside_quoted_attribute: Option<char>,
    pub inside_html_tag: bool,
}

pub fn tokenize(source: &str) -> Vec<Token> {
    let mut tokens = Vec::with_capacity(source.len() / 8 + 4);
    let mut tokenizer = Tokenizer::new(source);
    tokenizer.restart(&mut tokens, 0, &TokenizeOptions::default());
    tokenizer.fill(&mut tokens, usize::MAX);
    tokens
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

/// The tokenizer, run on demand: [`crate::parser::Parser::reslice_tokens_from`] re-tokenizes the
/// rest of a document only as far as the parser reads it.
pub(crate) struct Tokenizer<'a> {
    source: &'a str,
    mode_stack: Vec<Mode>,
    mode: Mode,
    pos: usize,
    text_start: Option<usize>,
    text_is_space: bool,
    quote_char: char,
    ended: bool,
    /// The last search for `}}`: where it started, and where it found one.
    close_search: (usize, Option<usize>),
}

impl<'a> Tokenizer<'a> {
    pub(crate) fn new(source: &'a str) -> Self {
        Tokenizer {
            source,
            mode_stack: Vec::new(),
            mode: Mode::Default,
            pos: 0,
            text_start: None,
            text_is_space: false,
            quote_char: '"',
            ended: false,
            close_search: (usize::MAX, None),
        }
    }

    /// Starts over at `start`, as if `source` began there. Tokens keep their offsets in `source`.
    pub(crate) fn restart(
        &mut self,
        tokens: &mut Vec<Token>,
        start: usize,
        options: &TokenizeOptions,
    ) {
        self.mode_stack.clear();
        self.mode = Mode::Default;
        self.pos = start;
        self.text_start = None;
        self.ended = false;
        if let Some(q) = options.inside_quoted_attribute {
            self.quote_char = q;
            self.mode_stack.push(Mode::HtmlTag);
            self.mode = Mode::QuotedValue;
        } else if options.inside_html_tag {
            self.mode = Mode::HtmlTag;
        }

        let (source, rest) = (self.source, &self.source.as_bytes()[start..]);
        if !options.skip_frontmatter && (rest.starts_with(b"---\n") || rest.starts_with(b"---\r\n"))
        {
            let search_start = source[start..].find('\n').map_or(start, |i| start + i + 1);
            if let Some(close) = source[search_start..]
                .find("\n---")
                .map(|i| i + search_start)
            {
                let (b, mut end) = (source.as_bytes(), close + 4);
                if end < b.len() && b[end] == b'\r' {
                    end += 1;
                }
                if end < b.len() && b[end] == b'\n' {
                    end += 1;
                }
                tokens.push(Token {
                    kind: TokenType::YamlFrontmatter,
                    start,
                    end,
                });
                self.pos = end;
            }
        }
    }

    /// Adds tokens until there are more than `index` of them, or until the input runs out, which
    /// adds `EndOfInput`.
    pub(crate) fn fill(&mut self, tokens: &mut Vec<Token>, index: usize) {
        let (source, b) = (self.source, self.source.as_bytes());
        let len = b.len();
        let mode_stack = &mut self.mode_stack;
        let (mut mode, mut pos, mut text_start, mut text_is_space, mut quote_char) = (
            self.mode,
            self.pos,
            self.text_start,
            self.text_is_space,
            self.quote_char,
        );

        macro_rules! flush_text {
            () => {
                if let Some(s) = text_start.take() {
                    tokens.push(Token {
                        kind: TokenType::Text,
                        start: s,
                        end: pos,
                    });
                }
            };
        }
        macro_rules! emit {
            ($kind:expr, $n:expr) => {{
                flush_text!();
                tokens.push(Token {
                    kind: $kind,
                    start: pos,
                    end: pos + $n,
                });
                pos += $n;
            }};
        }
        macro_rules! push_mode {
            ($m:expr) => {{
                mode_stack.push(mode);
                mode = $m;
            }};
        }
        macro_rules! pop_mode {
            () => {
                mode = mode_stack.pop().unwrap_or(Mode::Default)
            };
        }
        macro_rules! start_text {
            () => {
                if text_start.is_none() {
                    text_start = Some(pos);
                }
            };
        }
        let at = |pos: usize, s: &[u8]| b[pos..].starts_with(s);
        // Extends the current text run up to the next byte that can start a token in this mode
        // (same result as looping one byte at a time).
        macro_rules! text_until {
            ($($stop:pat_param)|+) => {{
                start_text!();
                pos += 1;
                while pos < len && !matches!(b[pos], $($stop)|+) {
                    pos += 1;
                }
            }};
        }

        // `scanLiquidOpen`, reused in Default, HtmlTag and QuotedValue modes.
        macro_rules! scan_liquid_open {
            () => {
                if b[pos] == b'{' && pos + 1 < len {
                    let dash = pos + 2 < len && b[pos + 2] == b'-';
                    let n = if dash { 3 } else { 2 };
                    if b[pos + 1] == b'{' {
                        emit!(TokenType::LiquidVariableOutputOpen, n);
                        push_mode!(Mode::LiquidVariableOutput);
                        continue;
                    }
                    if b[pos + 1] == b'%' {
                        emit!(TokenType::LiquidTagOpen, n);
                        push_mode!(Mode::LiquidTag);
                        continue;
                    }
                }
            };
        }

        while pos < len && tokens.len() <= index {
            match mode {
                Mode::LiquidTag => {
                    if at(pos, b"-%}") {
                        emit!(TokenType::LiquidTagClose, 3);
                        pop_mode!();
                    } else if at(pos, b"%}") {
                        emit!(TokenType::LiquidTagClose, 2);
                        pop_mode!();
                    } else {
                        text_until!(b'-' | b'%');
                    }
                }
                Mode::LiquidVariableOutput => {
                    if at(pos, b"-}}") {
                        emit!(TokenType::LiquidVariableOutputClose, 3);
                        pop_mode!();
                    } else if at(pos, b"}}") {
                        emit!(TokenType::LiquidVariableOutputClose, 2);
                        pop_mode!();
                    } else {
                        // Jump to the close, rather than step to it.
                        start_text!();
                        pos = next_output_close(source, &mut self.close_search, pos);
                    }
                }
                Mode::Default => {
                    scan_liquid_open!();
                    if b[pos] == b'<' || b[pos] == b'-' {
                        if at(pos, b"<!--") {
                            emit!(TokenType::HtmlCommentOpen, 4);
                            continue;
                        }
                        if at(pos, b"-->") {
                            emit!(TokenType::HtmlCommentClose, 3);
                            continue;
                        }
                        if at(pos, b"<!") {
                            emit!(TokenType::HtmlDoctypeOpen, 2);
                            push_mode!(Mode::HtmlTag);
                            continue;
                        }
                        if at(pos, b"</")
                            && pos + 2 < len
                            && (b[pos + 2].is_ascii_alphabetic() || b[pos + 2] == b'{')
                        {
                            emit!(TokenType::HtmlCloseTagOpen, 2);
                            push_mode!(Mode::HtmlTag);
                            continue;
                        }
                        if b[pos] == b'<'
                            && pos + 1 < len
                            && (b[pos + 1].is_ascii_alphabetic() || b[pos + 1] == b'{')
                        {
                            emit!(TokenType::HtmlTagOpen, 1);
                            push_mode!(Mode::HtmlTag);
                            continue;
                        }
                    }
                    text_until!(b'{' | b'<' | b'-');
                }
                Mode::HtmlTag => {
                    scan_liquid_open!();
                    if at(pos, b"/>") {
                        emit!(TokenType::HtmlSelfClose, 2);
                        pop_mode!();
                        continue;
                    }
                    if b[pos] == b'>' {
                        emit!(TokenType::HtmlTagClose, 1);
                        pop_mode!();
                        continue;
                    }
                    if b[pos] == b'=' {
                        emit!(TokenType::HtmlEquals, 1);
                        continue;
                    }
                    if let Some(q) = quote_at(b, pos) {
                        quote_char = q;
                        emit!(TokenType::HtmlQuoteOpen, q.len_utf8());
                        push_mode!(Mode::QuotedValue);
                        continue;
                    }
                    let c = source[pos..].chars().next().unwrap();
                    let is_space = is_js_space(c);
                    if text_start.is_some() && is_space != text_is_space {
                        flush_text!();
                    }
                    if text_start.is_none() {
                        text_is_space = is_space;
                    }
                    start_text!();
                    pos += c.len_utf8();
                }
                Mode::QuotedValue => {
                    scan_liquid_open!();
                    if let Some(q) = quote_at(b, pos) {
                        if q == closing_quote_for(quote_char) || q == quote_char {
                            emit!(TokenType::HtmlQuoteClose, q.len_utf8());
                            pop_mode!();
                            continue;
                        }
                    }
                    text_until!(b'{' | b'"' | b'\'' | 0xE2);
                }
            }
        }

        if pos >= len && !self.ended {
            flush_text!();
            tokens.push(Token {
                kind: TokenType::EndOfInput,
                start: len,
                end: len,
            });
            self.ended = true;
        }
        (
            self.mode,
            self.pos,
            self.text_start,
            self.text_is_space,
            self.quote_char,
        ) = (mode, pos, text_start, text_is_space, quote_char);
    }
}

/// Where the `-}}` or `}}` that closes Liquid output at `pos` begins, or the end of `source`.
/// Neither begins at `pos` itself, or it would have matched. Restarts after raw tags can land
/// inside the same unclosed `{{` again and again, and `memo`, the last search, keeps each from
/// searching the rest anew.
fn next_output_close(source: &str, memo: &mut (usize, Option<usize>), pos: usize) -> usize {
    let (from, found) = *memo;
    let found = if pos < from || found.is_some_and(|f| pos > f) {
        let found = crate::find_ascii(&source[pos..], "}}").map(|i| pos + i);
        *memo = (pos, found);
        found
    } else {
        found
    };
    match found {
        Some(f) if source.as_bytes()[f - 1] == b'-' => f - 1,
        Some(f) => f,
        None => source.len(),
    }
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
