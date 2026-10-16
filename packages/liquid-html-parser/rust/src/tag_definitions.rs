//! Port of `src/tag-definitions.ts`.
//!
//! TS `TagKind` is not ported: the `TagDefinition` variant is the kind.

use crate::ast::LiquidStatement;
use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::value::JsVal;

/// TS `Parser`, the callback from a tag into the document parser. 5c's
/// document parser implements it.
pub trait Parser {
    /// `start_offset` is a byte offset into the source.
    fn parse_liquid_statement(
        &mut self,
        tag_name: &str,
        markup_string: &str,
        start_offset: usize,
        ctx: &mut LiquidLineContext,
    ) -> Result<LiquidStatement, ParseError>;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BranchName {
    Elsif,
    Else,
    When,
}

/// TS `parse(name, markup, parser)` of a tag definition.
pub type TagParse = fn(&str, &mut MarkupParser<'_>, &mut dyn Parser) -> Result<JsVal, ParseError>;

/// TS `TagDefinitionBlock`, `TagDefinitionTag` and `TagDefinitionRaw`.
pub enum TagDefinition {
    Block {
        parse: TagParse,
        #[allow(dead_code)] // 5c: src/document/liquid-blocks.ts:89
        branches: &'static [BranchName],
    },
    Tag {
        parse: TagParse,
    },
    Raw {
        #[allow(dead_code)] // 5c: src/document/liquid-raw.ts:156
        parse_liquid_in_body: Option<bool>,
        parse: TagParse,
    },
}

impl TagDefinition {
    pub fn parse(&self) -> TagParse {
        match self {
            TagDefinition::Block { parse, .. } => *parse,
            TagDefinition::Tag { parse } => *parse,
            TagDefinition::Raw { parse, .. } => *parse,
        }
    }
}

/// TS `LiquidLine`, a parsed line from a `{% liquid %}` body. Offsets are
/// byte offsets into the source.
pub struct LiquidLine {
    pub tag_name: String,
    pub markup: String,
    pub markup_offset: usize,
    #[allow(dead_code)] // 5c: src/document/liquid-lines.ts:75
    pub name_offset: usize,
    #[allow(dead_code)] // 5c: src/document/liquid-lines.ts:76
    pub line_end: usize,
}

/// TS `LiquidLineContext`, the shared iterator over a `{% liquid %}` body's
/// lines. Nested block lines advance `index`.
pub struct LiquidLineContext {
    pub lines: Vec<LiquidLine>,
    pub index: usize,
}
