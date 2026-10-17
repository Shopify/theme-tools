//! Port of `src/document/base.ts`, the token cursor `ParserBase`.
//!
//! TS `DocumentParser` extends `ParserBase`, so these are methods of
//! `DocumentParser` here.

use crate::document::parser::DocumentParser;
use crate::document::tokenizer::{Token, TokenType, TokenizeOptions, tokenize};
use crate::errors::ParseError;

impl<'a> DocumentParser<'a> {
    pub fn consume(&mut self, kind: TokenType) -> Result<Token, ParseError> {
        let token = self.tokens[self.p];
        if token.kind != kind {
            return Err(ParseError::parsing(
                format!("Expected {} but got {}", kind.as_str(), token.kind.as_str()),
                token.start,
                token.end,
            ));
        }
        self.p += 1;
        Ok(token)
    }

    pub fn accept(&mut self, kind: TokenType) -> Option<Token> {
        let token = self.tokens[self.p];
        if token.kind != kind {
            return None;
        }
        self.p += 1;
        Some(token)
    }

    pub fn check(&self, kind: TokenType) -> bool {
        self.check_ahead(kind, 0)
    }

    /// TS `check(type, ahead)`.
    pub fn check_ahead(&self, kind: TokenType, ahead: usize) -> bool {
        self.tokens
            .get(self.p + ahead)
            .is_some_and(|token| token.kind == kind)
    }

    pub fn peek(&self) -> Token {
        self.tokens[self.p]
    }

    pub fn advance(&mut self) -> Token {
        let token = self.tokens[self.p];
        self.p += 1;
        token
    }

    pub fn is_at_end(&self) -> bool {
        self.tokens[self.p].kind == TokenType::EndOfInput
    }

    /// Whether this document parse is tolerant. The strict/default parser
    /// returns false. Markup-construction sites consult this to enable the
    /// markup parser's tolerant recovery (`enable_tolerant()`).
    pub fn is_tolerant(&self) -> bool {
        self.tolerant
    }

    pub fn token_at(&self, index: usize) -> Token {
        self.tokens[index]
    }

    /// TS `tokenAt(index)` where `index` may be past the end, which TS reads
    /// as `undefined`.
    pub fn token_at_checked(&self, index: usize) -> Option<Token> {
        self.tokens.get(index).copied()
    }

    pub fn token_count(&self) -> usize {
        self.tokens.len()
    }

    pub fn get_position(&self) -> usize {
        self.p
    }

    pub fn set_position(&mut self, index: usize) {
        self.p = index;
    }

    /// Move the cursor to the first token whose `start` is at or after
    /// `source_offset`. Unlike a cached token index, a source offset is stable
    /// across `reslice_tokens_from`, which renumbers token slots but preserves
    /// offsets.
    pub fn seek_to_source_offset(&mut self, source_offset: usize) {
        self.p = self.first_token_at_or_after(source_offset);
    }

    fn first_token_at_or_after(&self, source_offset: usize) -> usize {
        self.tokens
            .iter()
            .position(|token| token.start >= source_offset)
            .unwrap_or(self.tokens.len())
    }

    /// If the given prefix tokens end inside an open HTML quoted attribute
    /// value, the quote character that opened it; otherwise `None`.
    fn open_quote_char_before(&self, prefix: &[Token]) -> Option<String> {
        let mut open_quote: Option<Token> = None;
        for token in prefix {
            if token.kind == TokenType::HtmlQuoteOpen {
                open_quote = Some(*token);
            } else if token.kind == TokenType::HtmlQuoteClose {
                open_quote = None;
            }
        }
        // TS `this.source[openQuote.start]`: every quote the tokenizer opens is
        // one BMP character, so the char at that byte is the unit TS reads.
        open_quote.and_then(|token| {
            self.source[token.start..]
                .chars()
                .next()
                .map(|c| c.to_string())
        })
    }

    /// Whether the prefix tokens end inside an open HTML tag: an
    /// `HtmlTagOpen`, `HtmlCloseTagOpen` or `HtmlDoctypeOpen` not yet balanced
    /// by an `HtmlTagClose` or `HtmlSelfClose`.
    fn inside_open_html_tag(&self, prefix: &[Token]) -> bool {
        let mut open = false;
        for token in prefix {
            match token.kind {
                TokenType::HtmlTagOpen
                | TokenType::HtmlCloseTagOpen
                | TokenType::HtmlDoctypeOpen => open = true,
                TokenType::HtmlTagClose | TokenType::HtmlSelfClose => open = false,
                _ => {}
            }
        }
        open
    }

    /// Re-tokenize the source from `source_offset` onward and splice the
    /// fresh tokens in, positioning the parser at the first of them, but only
    /// when a token straddles the boundary. Otherwise just move the cursor to
    /// the first token at or after `source_offset`.
    pub fn reslice_tokens_from(&mut self, source_offset: usize) {
        let straddles = self
            .tokens
            .iter()
            .any(|token| token.start < source_offset && token.end > source_offset);

        if !straddles {
            self.p = self.first_token_at_or_after(source_offset);
            return;
        }

        let prefix: Vec<Token> = self
            .tokens
            .iter()
            .copied()
            .filter(|token| token.end <= source_offset)
            .collect();
        let inside_quoted_attribute = self.open_quote_char_before(&prefix);
        let inside_html_tag =
            inside_quoted_attribute.is_none() && self.inside_open_html_tag(&prefix);
        let options = TokenizeOptions {
            skip_frontmatter: true,
            inside_quoted_attribute,
            inside_html_tag,
        };
        let rebased = tokenize(&self.source[source_offset..], &options)
            .into_iter()
            .map(|token| Token {
                kind: token.kind,
                start: token.start + source_offset,
                end: token.end + source_offset,
            });
        self.p = prefix.len();
        self.tokens = prefix.into_iter().chain(rebased).collect();
    }
}
