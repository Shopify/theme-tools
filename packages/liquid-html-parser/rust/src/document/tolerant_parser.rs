//! Port of `src/document/tolerant-parser.ts`.
//!
//! TS `TolerantDocumentParser` extends `DocumentParser` and overrides
//! `isTolerant` and `parseNode`. Here the parser's `tolerant` flag selects
//! this `parse_node` in `DocumentParser::parse_node`, and `is_tolerant` reads
//! the same flag.

use crate::document::node_dispatch::parse_node as parse_node_fn;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::TokenType;
use crate::errors::ParseError;
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

/// Whether a token type opens a construct we can safely resume parsing on.
/// TS `isResyncToken`, a lookup in the `RESYNC_TOKENS` set.
pub fn is_resync_token(kind: TokenType) -> bool {
    matches!(
        kind,
        TokenType::LiquidTagOpen
            | TokenType::LiquidVariableOutputOpen
            | TokenType::HtmlTagOpen
            | TokenType::HtmlCloseTagOpen
            | TokenType::HtmlCommentOpen
            | TokenType::HtmlDoctypeOpen
            | TokenType::EndOfInput
    )
}

/// The readable name of a token type. TS `TokenType` is a string enum, so its
/// value is already the name.
pub fn token_type_name(kind: TokenType) -> &'static str {
    kind.as_str()
}

/// TS `makeLiquidErrorNode(start, end, source, message, found)`.
pub fn make_liquid_error_node(start: usize, end: usize, message: &str, found: &str) -> JsVal {
    obj! {
        "type" => JsVal::node_type(NodeTypes::LiquidErrorNode),
        "position" => JsVal::position(start, end),
        "source" => JsVal::Null,
        "message" => JsVal::str(message),
        "found" => JsVal::str(found),
    }
}

/// TS `TolerantDocumentParser.parseNode()`. On a parsing error it returns a
/// `LiquidErrorNode` covering the skipped region and resynchronizes onto the
/// next construct-open boundary. Any other error is returned unchanged.
pub fn parse_node(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let start_tok = parser.peek();
    let start_pos = parser.get_position();
    let error = match parse_node_fn(parser) {
        Ok(node) => return Ok(node),
        Err(error @ ParseError::LiquidHtmlAstParsing { .. }) => error,
        // TS tolerant-parser.ts:88 rethrows anything that is not a LiquidHTMLASTParsingError.
        Err(error) => return Err(error),
    };
    let found = token_type_name(parser.peek().kind);
    // At least one token of progress, so a stalled parse cannot loop forever.
    if parser.get_position() <= start_pos {
        parser.advance();
    }
    while !parser.is_at_end() && !is_resync_token(parser.peek().kind) {
        parser.advance();
    }
    let end = parser.peek().start;
    Ok(make_liquid_error_node(
        start_tok.start,
        end,
        error.message(),
        found,
    ))
}
