//! Port of `src/tags/ifchanged.ts`.

use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::Parser;
use crate::value::JsVal;

pub fn parse(
    _name: &str,
    _markup: &mut MarkupParser<'_>,
    _parser: &mut dyn Parser,
) -> Result<JsVal, ParseError> {
    // ifchanged takes no markup
    Ok(JsVal::Null)
}
