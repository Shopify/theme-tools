//! Port of `src/document/parser.ts`.
//!
//! TS splits the parser across free functions that take the parser as a
//! narrow delegate interface, and `DocumentParser` forwards to them. The Rust
//! free functions take `&mut DocumentParser` and call each other directly, so
//! the forwarding methods and the delegate getters are not ported. Each getter
//! reads one of the fields below.

use crate::ast::LiquidStatement;
use crate::document::factories::make_document_node;
use crate::document::liquid_lines::parse_liquid_statement;
use crate::document::node_dispatch::parse_node;
use crate::document::tokenizer::{Token, TokenType};
use crate::document::tree_builder::{ChildFilterMode, filter_children};
use crate::errors::ParseError;
use crate::tag_definitions::{LiquidLineContext, Parser};
use crate::value::JsVal;

pub struct DocumentParser<'a> {
    pub(crate) tokens: Vec<Token>,
    pub(crate) source: &'a str,
    pub(crate) p: usize,
    /// TS `_parseHtml`, read as `rawParseHtml`, `blockParseHtml`,
    /// `htmlParseHtml`, `lineParseHtml` and `dispatchParseHtml`.
    pub(crate) parse_html: bool,
    /// TS `_allowUnclosedHtml`, read as `blockAllowUnclosedHtml`,
    /// `htmlAllowUnclosedHtml` and `dispatchAllowUnclosedHtml`.
    pub(crate) allow_unclosed_html: bool,
    pub(crate) allow_unclosed_document_node: bool,
    pub(crate) in_attribute_context: bool,
    pub(crate) in_attribute_value_context: bool,
}

impl<'a> DocumentParser<'a> {
    pub fn new(
        tokens: Vec<Token>,
        source: &'a str,
        parse_html: bool,
        allow_unclosed_document_node: bool,
    ) -> Self {
        Self {
            tokens,
            source,
            p: 0,
            parse_html,
            allow_unclosed_html: allow_unclosed_document_node,
            allow_unclosed_document_node,
            in_attribute_context: false,
            in_attribute_value_context: false,
        }
    }

    // document := yamlFrontmatter? node*
    pub fn parse_document(&mut self) -> Result<JsVal, ParseError> {
        let mut children = Vec::new();
        if self.check(TokenType::YamlFrontmatter) {
            children.push(parse_node(self)?);
        }
        while !self.is_at_end() {
            children.push(parse_node(self)?);
        }
        Ok(make_document_node(
            filter_children(ChildFilterMode::Syntactic, children, self.source),
            self.source,
        ))
    }
}

impl Parser for DocumentParser<'_> {
    fn parse_liquid_statement(
        &mut self,
        tag_name: &str,
        markup_string: &str,
        start_offset: usize,
        ctx: &mut LiquidLineContext,
    ) -> Result<LiquidStatement, ParseError> {
        parse_liquid_statement(self, tag_name, markup_string, start_offset, ctx)
    }
}
