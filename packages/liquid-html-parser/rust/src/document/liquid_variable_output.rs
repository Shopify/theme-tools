//! Port of `src/document/liquid-variable-output.ts`.

use crate::document::base::tokenize_markup_at;
use crate::document::factories::make_liquid_variable_output;
use crate::document::parser::DocumentParser;
use crate::document::tokenizer::TokenType;
use crate::errors::ParseError;
use crate::js::js_trim;
use crate::markup::parser::MarkupParser;
use crate::value::JsVal;

// liquidVariableOutput := "{{" liquidVariable "}}"
pub fn parse_liquid_variable_output(parser: &mut DocumentParser<'_>) -> Result<JsVal, ParseError> {
    let open_token = parser.consume(TokenType::LiquidVariableOutputOpen)?;
    parser.accept(TokenType::Text);
    let close_token = parser.consume(TokenType::LiquidVariableOutputClose)?;

    let source = parser.source;
    let raw_markup = &source[open_token.end..close_token.start];

    let tokens = tokenize_markup_at(raw_markup, open_token.end);
    let mut markup_parser = MarkupParser::new(tokens, source, None, None);
    if parser.is_tolerant() {
        markup_parser.enable_tolerant();
    }
    let markup = match markup_parser.liquid_variable() {
        Ok(liquid_variable) if markup_parser.is_at_end() => liquid_variable,
        // TS `catch {}`, or markup left after the variable.
        _ => JsVal::str(js_trim(raw_markup)),
    };

    Ok(make_liquid_variable_output(open_token, close_token, markup))
}
