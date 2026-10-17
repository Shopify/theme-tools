//! Port of `src/markup/parser.ts`, strict and tolerant modes.
//!
//! The TS lax mode is not ported. Only `liquid-render-tree`'s lax recovery
//! enables it, and that stays TS-only. With lax off, the TS
//! `openSquareContinuesLookup` is always true, so it is inlined away.
//!
//! Offsets are byte offsets into the source. Nodes are `JsVal` objects built
//! with their keys in the TS order.

use crate::ast::LIQUID_LITERAL_VALUES;
use crate::errors::ParseError;
use crate::js::{JS_OBJECT_PROTOTYPE_KEYS, js_is_whitespace, js_object_prototype_has};
use crate::markup::expression_adapter::{
    ComparisonBinaryExpression, ComparisonOp, Expression, LogicalBinaryExpression, LogicalOperator,
    adapt_complex, adapt_conditional,
};
use crate::markup::tokenizer::{MarkupToken, MarkupTokenType};
use crate::types::NodeTypes;
use crate::value::{JsVal, obj};

pub struct MarkupParser<'a> {
    tokens: Vec<MarkupToken<'a>>,
    source: &'a str,
    p: usize,
    markup_start: usize,
    markup_end: usize,
    /// Tolerant recovery, enabled only by the tolerant document parser.
    tolerant: bool,
}

/// TS `bodyContext()`'s `{ source, bodyStart, bodyEnd }`.
pub struct BodyContext<'a> {
    pub source: &'a str,
    pub body_start: usize,
    pub body_end: usize,
}

impl<'a> MarkupParser<'a> {
    /// `tokens` must end with the EndOfString token, as `tokenize_markup`
    /// returns them, with offsets shifted to the source.
    pub fn new(
        tokens: Vec<MarkupToken<'a>>,
        source: &'a str,
        markup_start: Option<usize>,
        markup_end: Option<usize>,
    ) -> Self {
        let first_start = tokens.first().map_or(0, |token| token.start);
        let markup_start = markup_start.unwrap_or(first_start);
        let markup_end = markup_end.unwrap_or_else(|| compute_last_token_end(&tokens));
        Self {
            tokens,
            source,
            p: 0,
            markup_start,
            markup_end,
            tolerant: false,
        }
    }

    /// Enables tolerant recovery for subsequent parse calls.
    pub fn enable_tolerant(&mut self) -> &mut Self {
        self.tolerant = true;
        self
    }

    pub fn is_tolerant(&self) -> bool {
        self.tolerant
    }

    /// True when the current token can begin a filter argument.
    fn at_argument_start(&self) -> bool {
        matches!(
            self.peek().kind,
            MarkupTokenType::String
                | MarkupTokenType::Number
                | MarkupTokenType::Id
                | MarkupTokenType::OpenSquare
                | MarkupTokenType::OpenRound
        )
    }

    /// Advances the cursor to the next `|`, leaving it unconsumed, or to the
    /// end of the markup.
    fn skip_to_next_pipe(&mut self) {
        while !self.is_at_end() && !self.look(MarkupTokenType::Pipe, 0) {
            self.p += 1;
        }
    }

    fn parsing_error(&self, message: String, token: MarkupToken<'_>) -> ParseError {
        ParseError::LiquidHtmlAstParsing {
            message,
            start: token.start,
            end: token.end,
            unclosed: None,
        }
    }

    pub fn consume(&mut self, kind: MarkupTokenType) -> Result<MarkupToken<'a>, ParseError> {
        let token = self.tokens[self.p];
        if token.kind != kind {
            return Err(self.parsing_error(
                format!(
                    "Expected {} but found {} ({})",
                    kind.as_str(),
                    token.kind.as_str(),
                    token.value
                ),
                token,
            ));
        }
        self.p += 1;
        Ok(token)
    }

    pub fn consume_optional(&mut self, kind: MarkupTokenType) -> Option<MarkupToken<'a>> {
        let token = self.tokens[self.p];
        if token.kind != kind {
            return None;
        }
        self.p += 1;
        Some(token)
    }

    pub fn look(&self, kind: MarkupTokenType, ahead: usize) -> bool {
        self.tokens
            .get(self.p + ahead)
            .is_some_and(|token| token.kind == kind)
    }

    pub fn peek(&self) -> MarkupToken<'a> {
        self.tokens[self.p]
    }

    pub fn id(&mut self, keyword: &str) -> bool {
        let token = self.tokens[self.p];
        if token.kind != MarkupTokenType::Id || token.value != keyword {
            return false;
        }
        self.p += 1;
        true
    }

    pub fn is_at_end(&self) -> bool {
        self.tokens[self.p].kind == MarkupTokenType::EndOfString
    }

    /// The start of the EndOfString token, the markup boundary.
    pub fn eos_start(&self) -> usize {
        self.tokens[self.tokens.len() - 1].start
    }

    /// The source and byte range of the full markup string. Advances the
    /// parser to the end, so `is_at_end()` returns true.
    pub fn body_context(&mut self) -> BodyContext<'a> {
        while !self.is_at_end() {
            self.p += 1;
        }
        BodyContext {
            source: self.source,
            body_start: self.markup_start,
            body_end: self.markup_end,
        }
    }

    // valueExpression := string | number | literal | variableLookup | range
    pub fn value_expression(&mut self) -> Result<JsVal, ParseError> {
        let token = self.peek();
        match token.kind {
            MarkupTokenType::String => {
                self.p += 1;
                Ok(obj! {
                    "type" => JsVal::node_type(NodeTypes::String),
                    "single" => JsVal::Bool(token.value.starts_with('\'')),
                    "value" => JsVal::str(&token.value[1..token.value.len() - 1]),
                    "position" => JsVal::position(token.start, token.end),
                    "source" => JsVal::Null,
                })
            }
            MarkupTokenType::Number => {
                self.p += 1;
                Ok(obj! {
                    "type" => JsVal::node_type(NodeTypes::Number),
                    "value" => JsVal::str(token.value),
                    "position" => JsVal::position(token.start, token.end),
                    "source" => JsVal::Null,
                })
            }
            MarkupTokenType::Id => self.id_value_expression(token),
            MarkupTokenType::OpenSquare => self.variable_lookup(),
            MarkupTokenType::OpenRound => self.range(),
            _ => Err(self.parsing_error(
                format!(
                    "Expected expression but found {} ({})",
                    token.kind.as_str(),
                    token.value
                ),
                token,
            )),
        }
    }

    /// The `Id` case of `valueExpression`: a literal keyword, or a lookup.
    fn id_value_expression(&mut self, token: MarkupToken<'a>) -> Result<JsVal, ParseError> {
        let followed_by_bracket_lookup = self.look(MarkupTokenType::OpenSquare, 1);
        let literal = literal_value(token.value);
        let is_literal =
            literal.is_some() && !self.look(MarkupTokenType::Dot, 1) && !followed_by_bracket_lookup;
        let (true, Some(value)) = (is_literal, literal) else {
            return self.variable_lookup();
        };
        self.p += 1;
        Ok(obj! {
            "type" => JsVal::node_type(NodeTypes::LiquidLiteral),
            "keyword" => JsVal::str(token.value),
            "value" => value,
            "position" => JsVal::position(token.start, token.end),
            "source" => JsVal::Null,
        })
    }

    /// The `OpenRound` case of `valueExpression`: a range.
    fn range(&mut self) -> Result<JsVal, ParseError> {
        let open_token = self.consume(MarkupTokenType::OpenRound)?;
        let start = self.value_expression()?;
        self.consume(MarkupTokenType::DotDot)?;
        let end = self.value_expression()?;
        let close_token = self.consume(MarkupTokenType::CloseRound)?;
        Ok(obj! {
            "type" => JsVal::node_type(NodeTypes::Range),
            "start" => start,
            "end" => end,
            "position" => JsVal::position(open_token.start, close_token.end),
            "source" => JsVal::Null,
        })
    }

    // variableLookup := (id | "[" valueExpression "]") ("." id | "[" valueExpression "]")*
    pub fn variable_lookup(&mut self) -> Result<JsVal, ParseError> {
        let current = self.peek();
        let (name, start_pos, mut end_pos) = match current.kind {
            MarkupTokenType::Id => {
                let token = self.consume(MarkupTokenType::Id)?;
                (JsVal::str(token.value), token.start, token.end)
            }
            MarkupTokenType::OpenSquare => (JsVal::Null, current.start, current.start),
            _ => {
                return Err(self.parsing_error(
                    format!(
                        "Expected identifier or [ but found {} ({})",
                        current.kind.as_str(),
                        current.value
                    ),
                    current,
                ));
            }
        };

        let mut lookups = Vec::new();
        let mut lookup_modes = Vec::new();
        while !self.is_at_end() {
            if self.consume_optional(MarkupTokenType::Dot).is_some() {
                let prop = self.consume(MarkupTokenType::Id)?;
                lookups.push(obj! {
                    "type" => JsVal::node_type(NodeTypes::String),
                    "value" => JsVal::str(prop.value),
                    "position" => JsVal::position(prop.start, prop.end),
                    "source" => JsVal::Null,
                });
                lookup_modes.push(JsVal::str("bareword"));
                end_pos = prop.end;
            } else if self.look(MarkupTokenType::OpenSquare, 0) {
                self.consume(MarkupTokenType::OpenSquare)?;
                let inner = self.value_expression()?;
                let close = self.consume(MarkupTokenType::CloseSquare)?;
                lookups.push(inner);
                lookup_modes.push(JsVal::str("subscript"));
                end_pos = close.end;
            } else {
                break;
            }
        }

        Ok(obj! {
            "type" => JsVal::node_type(NodeTypes::VariableLookup),
            "name" => name,
            "lookups" => JsVal::array(lookups),
            "lookupModes" => JsVal::array(lookup_modes),
            "position" => JsVal::position(start_pos, end_pos),
            "source" => JsVal::Null,
        })
    }

    // comparison := valueExpression (comparisonOp valueExpression)?
    fn comparison(&mut self) -> Result<Expression, ParseError> {
        let left = self.value_expression()?;
        let token = self.peek();

        if token.kind != MarkupTokenType::Comparison && token.kind != MarkupTokenType::Equality {
            return Ok(Expression::Value(left));
        }

        let Some(op) = ComparisonOp::parse(token.value) else {
            return Err(self.parsing_error(format!("Unknown operator {}", token.value), token));
        };

        self.p += 1;
        let right = self.value_expression()?;
        let position = JsVal::position(left.start(), right.end());
        Ok(Expression::Comparison(Box::new(
            ComparisonBinaryExpression {
                left,
                op,
                right,
                position,
            },
        )))
    }

    // logical := comparison (("and" | "or") logical)?
    fn logical_expr(&mut self) -> Result<Expression, ParseError> {
        let left = self.comparison()?;
        let token = self.peek();

        if token.kind != MarkupTokenType::Logical {
            return Ok(left);
        }

        let Some(op) = LogicalOperator::parse(token.value) else {
            return Err(
                self.parsing_error(format!("Unknown logical operator: {}", token.value), token)
            );
        };

        let op_start = token.start;
        self.p += 1;
        let right = self.logical_expr()?;
        let position = JsVal::position(left.start(), right.end());
        Ok(Expression::Logical(Box::new(LogicalBinaryExpression {
            left,
            op,
            right,
            op_start,
            position,
        })))
    }

    // conditionalExpression := logical
    pub fn conditional_expression(&mut self) -> Result<JsVal, ParseError> {
        let result = adapt_conditional(self.logical_expr()?);
        // The original parser extends LogicalExpression position.end to the
        // markup boundary (eosStart), on every nested LogicalExpression.
        extend_logical_end(&result, self.eos_start());
        Ok(result)
    }

    // expression := logical
    fn expression(&mut self) -> Result<JsVal, ParseError> {
        Ok(adapt_complex(self.logical_expr()?))
    }

    // liquidVariable := expression filter*
    pub fn liquid_variable(&mut self) -> Result<JsVal, ParseError> {
        let expr = self.expression()?;
        let filter_list = self.filters(expr.end())?;
        let token_end = filter_list.last().map_or_else(|| expr.end(), JsVal::end);
        let start = expr.start();
        // The end extends to the markup boundary, the EndOfString token's start.
        let end = self.eos_start();
        let raw_source = &self.source[start..token_end];
        Ok(obj! {
            "type" => JsVal::node_type(NodeTypes::LiquidVariable),
            "expression" => expr,
            "filters" => JsVal::array(filter_list),
            "rawSource" => JsVal::str(raw_source),
            "position" => JsVal::position(start, end),
            "source" => JsVal::Null,
        })
    }

    // filters := ("|" filter)*
    fn filters(&mut self, mut previous_end: usize) -> Result<Vec<JsVal>, ParseError> {
        let mut result = Vec::new();
        while self.consume_optional(MarkupTokenType::Pipe).is_some() {
            // Tolerant: a `|` not followed by a filter name is dropped.
            if self.tolerant && !self.look(MarkupTokenType::Id, 0) {
                self.skip_to_next_pipe();
                continue;
            }
            let filter_node = self.filter(previous_end)?;
            previous_end = filter_node.end();
            result.push(filter_node);
        }
        Ok(result)
    }

    // filter := id (":" arguments?)?
    fn filter(&mut self, previous_end: usize) -> Result<JsVal, ParseError> {
        let name_token = self.consume(MarkupTokenType::Id)?;
        let mut args = Vec::new();
        let mut end = name_token.end;
        if let Some(colon) = self.consume_optional(MarkupTokenType::Colon) {
            end = colon.end;
            let at_filter_boundary = self.is_at_end() || self.look(MarkupTokenType::Pipe, 0);
            let has_only_whitespace_before_boundary = self.source[colon.end..self.peek().start]
                .chars()
                .all(js_is_whitespace);
            let empty_arguments = at_filter_boundary && has_only_whitespace_before_boundary;
            // Strict mode accepts an empty list at a clean filter boundary.
            // Tolerant mode also skips fragments that cannot start an argument.
            if !empty_arguments && (!self.tolerant || self.at_argument_start()) {
                args = self.arguments()?;
            }
            if let Some(last) = args.last() {
                end = last.end();
            }
        }
        Ok(obj! {
            "type" => JsVal::node_type(NodeTypes::LiquidFilter),
            "name" => JsVal::str(name_token.value),
            "args" => JsVal::array(args),
            "position" => JsVal::position(previous_end, end),
            "source" => JsVal::Null,
        })
    }

    // argument := namedArgument | valueExpression
    fn argument(&mut self) -> Result<JsVal, ParseError> {
        if self.look(MarkupTokenType::Id, 0) && self.lookahead_for_named_argument() {
            return self.named_argument();
        }
        self.value_expression()
    }

    /// Whether the tokens at the cursor form a named argument key:
    /// `Id (Dot Id)* Colon`.
    fn lookahead_for_named_argument(&self) -> bool {
        let mut ahead = 1;
        while self.look(MarkupTokenType::Dot, ahead) && self.look(MarkupTokenType::Id, ahead + 1) {
            ahead += 2;
        }
        self.look(MarkupTokenType::Colon, ahead)
    }

    /// TS `id ("." id)*` of a named argument key, joined with dots.
    fn dotted_name(&mut self) -> Result<(MarkupToken<'a>, String), ParseError> {
        let name_token = self.consume(MarkupTokenType::Id)?;
        let mut name = name_token.value.to_string();
        while self.consume_optional(MarkupTokenType::Dot).is_some() {
            let segment = self.consume(MarkupTokenType::Id)?;
            name.push('.');
            name.push_str(segment.value);
        }
        Ok((name_token, name))
    }

    // namedArgument := id ("." id)* ":" valueExpression
    pub fn named_argument(&mut self) -> Result<JsVal, ParseError> {
        let (name_token, name) = self.dotted_name()?;
        self.consume(MarkupTokenType::Colon)?;
        let value = self.value_expression()?;
        let end = value.end();
        Ok(obj! {
            "type" => JsVal::node_type(NodeTypes::NamedArgument),
            "name" => JsVal::Str(name),
            "value" => value,
            "position" => JsVal::position(name_token.start, end),
            "source" => JsVal::Null,
        })
    }

    // arguments := argument ("," argument)*
    pub fn arguments(&mut self) -> Result<Vec<JsVal>, ParseError> {
        let mut args = vec![self.argument()?];
        while self.consume_optional(MarkupTokenType::Comma).is_some() {
            // Tolerant: a trailing or empty comma ends the argument list.
            if self.tolerant && !self.at_argument_start() {
                break;
            }
            args.push(self.argument()?);
        }
        Ok(args)
    }

    // namedArguments := namedArgument ("," namedArgument)* ","?
    pub fn named_arguments(&mut self) -> Result<Vec<JsVal>, ParseError> {
        let mut args = vec![self.named_argument()?];
        while self.consume_optional(MarkupTokenType::Comma).is_some() {
            if !self.look(MarkupTokenType::Id, 0) {
                break; // trailing comma
            }
            args.push(self.named_argument()?);
        }
        Ok(args)
    }

    // blockNamedArguments := blockNamedArgument ("," blockNamedArgument)* ","?
    pub fn block_named_arguments(&mut self) -> Result<Vec<JsVal>, ParseError> {
        let mut args = Vec::new();
        self.push_block_named_argument(&mut args)?;
        while self.consume_optional(MarkupTokenType::Comma).is_some() {
            if !self.look(MarkupTokenType::Id, 0) {
                break; // trailing comma
            }
            self.push_block_named_argument(&mut args)?;
        }
        Ok(args)
    }

    /// Parses one block named argument and appends it to `args`.
    fn push_block_named_argument(&mut self, args: &mut Vec<JsVal>) -> Result<(), ParseError> {
        let (name_token, name) = self.dotted_name()?;
        self.consume(MarkupTokenType::Colon)?;
        let value = self.block_value_expression()?;
        let position = JsVal::position(name_token.start, value.end());
        args.push(obj! {
            "type" => JsVal::node_type(NodeTypes::NamedArgument),
            "name" => JsVal::Str(name),
            "value" => value,
            "position" => position,
            "source" => JsVal::Null,
        });
        Ok(())
    }

    /// A block or section argument value: `[` opens an array literal, and
    /// everything else is a `valueExpression`.
    fn block_value_expression(&mut self) -> Result<JsVal, ParseError> {
        if self.look(MarkupTokenType::OpenSquare, 0) {
            return self.block_array_literal();
        }
        self.value_expression()
    }

    /// Rejects a nested array element, matching Ruby's "no nested arrays".
    fn assert_not_nested_array(&self) -> Result<(), ParseError> {
        if !self.look(MarkupTokenType::OpenSquare, 0) {
            return Ok(());
        }
        Err(self.parsing_error(
            "nested arrays are not supported in block array literal".to_string(),
            self.peek(),
        ))
    }

    /// A single-level array literal.
    fn block_array_literal(&mut self) -> Result<JsVal, ParseError> {
        let open_token = self.consume(MarkupTokenType::OpenSquare)?;
        let mut elements = Vec::new();

        while !self.look(MarkupTokenType::CloseSquare, 0) {
            self.assert_not_nested_array()?;
            elements.push(self.value_expression()?);
            if !self.look(MarkupTokenType::CloseSquare, 0) {
                self.consume(MarkupTokenType::Comma)?;
            }
        }

        let close_token = self.consume(MarkupTokenType::CloseSquare)?;
        Ok(obj! {
            "type" => JsVal::str("BlockArrayLiteral"),
            "elements" => JsVal::array(elements),
            "position" => JsVal::position(open_token.start, close_token.end),
            "source" => JsVal::Null,
        })
    }
}

fn compute_last_token_end(tokens: &[MarkupToken<'_>]) -> usize {
    let last = tokens
        .iter()
        .rev()
        .find(|token| token.kind != MarkupTokenType::EndOfString);
    if let Some(token) = last {
        return token.end;
    }
    tokens.first().map_or(0, |token| token.start)
}

/// Recursively extends `position.end` to `end` on every nested
/// LogicalExpression.
fn extend_logical_end(node: &JsVal, end: usize) {
    if !node.type_is(NodeTypes::LogicalExpression.as_str()) {
        return;
    }
    let position = node.get("position").spread();
    position.set("end", JsVal::Offset(end));
    node.set("position", position);
    extend_logical_end(&node.get("right"), end);
}

/// TS `isLiteralKeyword(s) ? LiquidLiteralValues[s] : ...`. `in` checks own
/// keys first, then the `Object.prototype` keys.
fn literal_value(keyword: &str) -> Option<JsVal> {
    let own = LIQUID_LITERAL_VALUES
        .iter()
        .find(|(name, _)| *name == keyword)
        .map(|(_, value)| value.clone());
    if own.is_some() || !js_object_prototype_has(keyword) {
        return own;
    }
    JS_OBJECT_PROTOTYPE_KEYS
        .iter()
        .find(|name| **name == keyword)
        .map(|name| JsVal::ProtoKey(name))
}
