//! Port of the error types in `src/errors.ts`.
//!
//! One Rust error carries the TS constructor, because the constructor changes
//! behaviour: `tolerant-parser.ts` rethrows anything that is not a
//! `LiquidHTMLASTParsingError`, and `backend.ts` rebuilds a different class per
//! constructor.

use crate::value::JsVal;

#[derive(Debug)]
pub enum ParseError {
    /// TS `throw new LiquidHTMLASTParsingError(message, source, start, end, unclosed)`.
    /// `start` and `end` are byte offsets into the source.
    LiquidHtmlAstParsing {
        message: String,
        start: usize,
        end: usize,
        unclosed: Option<JsVal>,
    },
    /// TS `throw new Error(message)`.
    Error { message: String },
}

impl ParseError {
    /// TS `new Error(message)`.
    pub fn error(message: impl Into<String>) -> ParseError {
        ParseError::Error {
            message: message.into(),
        }
    }

    /// TS `new LiquidHTMLASTParsingError(message, source, start, end)`, with
    /// no `unclosed` node.
    pub fn parsing(message: impl Into<String>, start: usize, end: usize) -> ParseError {
        ParseError::LiquidHtmlAstParsing {
            message: message.into(),
            start,
            end,
            unclosed: None,
        }
    }

    /// TS `e.message`.
    pub fn message(&self) -> &str {
        match self {
            ParseError::LiquidHtmlAstParsing { message, .. } => message,
            ParseError::Error { message } => message,
        }
    }
}
