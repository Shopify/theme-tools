//! Port of `src/liquid-doc/parser.ts`.
//!
//! Offsets are byte offsets into the source, so every TS `.length` that feeds
//! an offset is a byte length here.

use crate::errors::ParseError;
use crate::js::{js_json_stringify_str, js_trim, js_trim_start};
use crate::liquid_doc::factories::{
    make_liquid_doc_description_node, make_liquid_doc_example_node, make_liquid_doc_param_node,
    make_liquid_doc_prompt_node, make_text_node,
};
use crate::liquid_doc::tokenizer::{
    LiquidDocToken, LiquidDocTokenType, ParamToken, ParamTokenType, tokenize_liquid_doc,
    tokenize_param_content,
};
use crate::value::JsVal;

/// Parse a LiquidDoc body into AST nodes. `start_offset` is the source offset
/// of `body[0]`.
pub fn parse_liquid_doc(
    body: &str,
    start_offset: usize,
    source: &str,
) -> Result<Vec<JsVal>, ParseError> {
    let tokens = tokenize_liquid_doc(body, start_offset);
    LiquidDocParser::new(tokens, source).parse()
}

/// TS `collectContentLines` options.
#[derive(Default)]
struct CollectOptions {
    stop_at_paragraph_break: bool,
    trim_trailing_newlines: bool,
}

/// TS `collectContentLines` result.
struct Collected {
    value: String,
    start_pos: usize,
    end_pos: usize,
}

/// Known annotation names that get dedicated node types.
#[derive(Clone, Copy)]
enum LiquidDocAnnotation {
    Param,
    Description,
    Example,
    Prompt,
}

const DESCRIPTION: &str = "description";

/// TS `isKnownAnnotation`, returning the narrowed name.
fn known_annotation(value: &str) -> Option<LiquidDocAnnotation> {
    match value {
        "param" => Some(LiquidDocAnnotation::Param),
        DESCRIPTION => Some(LiquidDocAnnotation::Description),
        "example" => Some(LiquidDocAnnotation::Example),
        "prompt" => Some(LiquidDocAnnotation::Prompt),
        _ => None,
    }
}

pub struct LiquidDocParser<'a> {
    tokens: Vec<LiquidDocToken<'a>>,
    source: &'a str,
    p: usize,
}

impl<'a> LiquidDocParser<'a> {
    pub fn new(tokens: Vec<LiquidDocToken<'a>>, source: &'a str) -> Self {
        Self {
            tokens,
            source,
            p: 0,
        }
    }

    // liquidDoc := implicitDescription? annotation*
    pub fn parse(&mut self) -> Result<Vec<JsVal>, ParseError> {
        let mut nodes = Vec::new();

        self.skip_blank_lines();

        if self.check(LiquidDocTokenType::TextLine) {
            nodes.push(self.parse_implicit_description());
        }

        self.skip_blank_lines();

        while !self.is_at_end() {
            if self.check(LiquidDocTokenType::Newline) {
                self.skip_newlines();
                continue;
            }

            if self.check(LiquidDocTokenType::Annotation) {
                nodes.push(self.parse_annotation()?);
                continue;
            }

            if self.check(LiquidDocTokenType::TextLine) && js_trim(self.peek().value).is_empty() {
                self.advance();
                continue;
            }

            if self.check(LiquidDocTokenType::TextLine) {
                let collected = self.collect_content_lines(CollectOptions {
                    trim_trailing_newlines: true,
                    ..CollectOptions::default()
                });
                if !js_trim(&collected.value).is_empty() {
                    nodes.push(make_text_node(
                        &collected.value,
                        collected.start_pos,
                        collected.end_pos,
                    ));
                }
                continue;
            }

            let tok = self.advance();
            nodes.push(make_text_node(tok.value, tok.start, tok.end));
        }

        Ok(nodes)
    }

    // implicitDescription := textLine+
    fn parse_implicit_description(&mut self) -> JsVal {
        let collected = self.collect_content_lines(CollectOptions::default());
        let content = make_text_node(&collected.value, collected.start_pos, collected.end_pos);
        make_liquid_doc_description_node(
            content,
            true,
            true,
            collected.start_pos,
            collected.end_pos,
        )
    }

    // annotation := "@" annotationName content
    fn parse_annotation(&mut self) -> Result<JsVal, ParseError> {
        let annotation_token = self.consume(LiquidDocTokenType::Annotation)?;
        let name = annotation_token.value;

        if name != DESCRIPTION && name.starts_with(DESCRIPTION) {
            return Ok(self.parse_glued_description(annotation_token));
        }

        let Some(annotation) = known_annotation(name) else {
            return Ok(self.parse_unsupported_annotation(annotation_token));
        };

        Ok(match annotation {
            LiquidDocAnnotation::Param => self.parse_param(annotation_token),
            LiquidDocAnnotation::Description => self.parse_description(annotation_token),
            LiquidDocAnnotation::Example => self.parse_example(annotation_token),
            LiquidDocAnnotation::Prompt => self.parse_prompt(annotation_token),
        })
    }

    // param := "@param" ("{" type "}")? ("[" name "]" | name) ("-" description)?
    fn parse_param(&mut self, annotation_token: LiquidDocToken<'a>) -> JsVal {
        let start = annotation_token.start;

        let Some(inline_token) = self.accept(LiquidDocTokenType::TextLine) else {
            let empty_name = make_text_node("", annotation_token.end, annotation_token.end);
            return make_liquid_doc_param_node(
                empty_name,
                JsVal::Null,
                JsVal::Null,
                true,
                start,
                annotation_token.end,
            );
        };

        let mut walker = ParamTokenWalker::new(tokenize_param_content(
            inline_token.value,
            inline_token.start,
        ));

        let param_type = walker
            .accept(ParamTokenType::Type)
            .map_or(JsVal::Null, |t| {
                make_text_node(t.value, t.start + 1, t.end - 1)
            });

        let (param_name, required) = match walker.accept(ParamTokenType::OptionalName) {
            Some(t) => (make_text_node(t.value, t.start + 1, t.end - 1), false),
            None => {
                let name = match walker.accept(ParamTokenType::Word) {
                    Some(t) => make_text_node(t.value, t.start, t.end),
                    None => make_text_node("", annotation_token.end, annotation_token.end),
                };
                (name, true)
            }
        };

        let dash_token = walker.accept(ParamTokenType::Dash);

        let mut inline_desc_range: Option<(usize, usize)> = None;
        while !walker.is_at_end() {
            let t = walker.advance();
            let desc_start = inline_desc_range.map_or(t.start, |(start, _)| start);
            inline_desc_range = Some((desc_start, t.end));
        }
        let inline_desc = inline_desc_range.map_or("", |(start, end)| &self.source[start..end]);

        let continuation = self.collect_content_lines(CollectOptions {
            stop_at_paragraph_break: true,
            trim_trailing_newlines: true,
        });
        let has_continuation = !js_trim(&continuation.value).is_empty();

        let mut param_description = JsVal::Null;
        let mut description_end = None;
        if !inline_desc.is_empty() || has_continuation {
            let full_desc = if has_continuation {
                format!("{inline_desc}{}", continuation.value)
            } else {
                inline_desc.to_string()
            };
            let desc_start = match (inline_desc_range, dash_token) {
                (Some((start, _)), _) => start,
                (None, Some(dash)) => dash.end + 1,
                (None, None) => annotation_token.end,
            };
            // Without a continuation the inline description is not empty, so
            // TS `inlineDescEnd` is set and the range exists.
            let desc_end = match inline_desc_range {
                _ if has_continuation => continuation.end_pos,
                Some((_, end)) => end,
                None => unreachable!("inline description without a range"),
            };
            param_description = make_text_node(&full_desc, desc_start, desc_end);
            description_end = Some(desc_end);
        }

        let end = description_end.unwrap_or(inline_token.end);
        make_liquid_doc_param_node(
            param_name,
            param_type,
            param_description,
            required,
            start,
            end,
        )
    }

    // description := "@description" content
    fn parse_description(&mut self, annotation_token: LiquidDocToken<'a>) -> JsVal {
        let start = annotation_token.start;

        if let Some(inline_token) = self.accept(LiquidDocTokenType::TextLine) {
            let rest = self.collect_content_lines(CollectOptions::default());
            let has_cont = !js_trim(&rest.value).is_empty();
            let full_content = if has_cont {
                format!("{}{}", inline_token.value, rest.value)
            } else {
                inline_token.value.to_string()
            };
            let end = if has_cont {
                rest.end_pos
            } else {
                inline_token.end
            };
            let content = make_text_node(&full_content, inline_token.start, end);
            return make_liquid_doc_description_node(content, false, true, start, end);
        }

        self.skip_blank_lines();
        let collected = self.collect_content_lines(CollectOptions::default());
        let (content_start, content_end) = block_content_range(&collected, annotation_token.end);
        let content = make_text_node(&collected.value, content_start, content_end);
        make_liquid_doc_description_node(content, false, false, start, content_end)
    }

    // gluedDescription := "@description" gluedContent  (no separating space)
    fn parse_glued_description(&mut self, annotation_token: LiquidDocToken<'a>) -> JsVal {
        let start = annotation_token.start;
        let content_start = start + 1 + DESCRIPTION.len();

        let inline_token = self.accept(LiquidDocTokenType::TextLine);
        let rest = self.collect_content_lines(CollectOptions::default());
        let has_rest = !js_trim(&rest.value).is_empty();

        let end = match inline_token {
            _ if has_rest => rest.end_pos,
            Some(token) => token.end,
            None => annotation_token.end,
        };

        let content = make_text_node(&self.source[content_start..end], content_start, end);
        make_liquid_doc_description_node(content, false, true, start, end)
    }

    // example := "@example" content
    fn parse_example(&mut self, annotation_token: LiquidDocToken<'a>) -> JsVal {
        let start = annotation_token.start;

        if let Some(inline_token) = self.accept(LiquidDocTokenType::TextLine) {
            let rest = self.collect_content_lines(CollectOptions::default());
            let has_cont = !js_trim(&rest.value).is_empty();
            let full_content = if has_cont {
                format!("{}{}", inline_token.value, rest.value)
            } else {
                inline_token.value.to_string()
            };
            let end = if has_cont {
                rest.end_pos
            } else {
                inline_token.end
            };
            let content = make_text_node(&full_content, inline_token.start, end);
            return make_liquid_doc_example_node(content, true, start, end);
        }

        self.skip_blank_lines();
        let collected = self.collect_content_lines(CollectOptions::default());
        let (content_start, content_end) = block_content_range(&collected, annotation_token.end);
        let content = make_text_node(&collected.value, content_start, content_end);
        make_liquid_doc_example_node(content, false, start, content_end)
    }

    // prompt := "@prompt" content
    fn parse_prompt(&mut self, annotation_token: LiquidDocToken<'a>) -> JsVal {
        let start = annotation_token.start;
        let collected = self.collect_content_lines(CollectOptions::default());
        let (content_start, content_end) = block_content_range(&collected, annotation_token.end);
        let content = make_text_node(&collected.value, content_start, content_end);
        make_liquid_doc_prompt_node(content, start, content_end)
    }

    // unsupportedAnnotation := "@" name content
    fn parse_unsupported_annotation(&mut self, annotation_token: LiquidDocToken<'a>) -> JsVal {
        let start = annotation_token.start;
        if let Some(inline_token) = self.accept(LiquidDocTokenType::TextLine) {
            let full_value = &self.source[start..inline_token.end];
            return make_text_node(full_value, start, inline_token.end);
        }
        let full_value = format!("@{}", annotation_token.value);
        make_text_node(&full_value, start, annotation_token.end)
    }

    fn peek(&self) -> LiquidDocToken<'a> {
        self.tokens[self.p]
    }

    fn consume(&mut self, kind: LiquidDocTokenType) -> Result<LiquidDocToken<'a>, ParseError> {
        let token = self.peek();
        if token.kind != kind {
            return Err(ParseError::error(format!(
                "Expected {} but found {} ({})",
                kind.as_str(),
                token.kind.as_str(),
                js_json_stringify_str(token.value)
            )));
        }
        self.advance();
        Ok(token)
    }

    fn accept(&mut self, kind: LiquidDocTokenType) -> Option<LiquidDocToken<'a>> {
        if self.peek().kind != kind {
            return None;
        }
        Some(self.advance())
    }

    fn check(&self, kind: LiquidDocTokenType) -> bool {
        self.tokens[self.p].kind == kind
    }

    fn is_at_end(&self) -> bool {
        self.check(LiquidDocTokenType::EndOfInput)
    }

    /// Consume the current token unconditionally and advance.
    fn advance(&mut self) -> LiquidDocToken<'a> {
        let token = self.tokens[self.p];
        self.p += 1;
        token
    }

    fn skip_newlines(&mut self) -> bool {
        let mut skipped = false;
        while self.check(LiquidDocTokenType::Newline) {
            self.advance();
            skipped = true;
        }
        skipped
    }

    /// TS `this.check(TextLine)` with a `value` that trims to `''`.
    fn at_blank_text_line(&self) -> bool {
        self.check(LiquidDocTokenType::TextLine) && js_trim(self.peek().value).is_empty()
    }

    /// Skip newlines and whitespace-only text lines.
    fn skip_blank_lines(&mut self) {
        while !self.is_at_end() {
            if self.check(LiquidDocTokenType::Newline) || self.at_blank_text_line() {
                self.advance();
                continue;
            }
            break;
        }
    }

    /// The index of the first token at or after `from` that is neither a
    /// newline nor a whitespace-only text line.
    fn skip_blank_from(&self, from: usize) -> usize {
        let mut look_ahead = from;
        while let Some(la) = self.tokens.get(look_ahead) {
            let blank_line =
                la.kind == LiquidDocTokenType::TextLine && js_trim(la.value).is_empty();
            if la.kind != LiquidDocTokenType::Newline && !blank_line {
                break;
            }
            look_ahead += 1;
        }
        look_ahead
    }

    /// TS: consume trailing newlines and whitespace-only text lines while
    /// `more` holds, adding each newline to `value` unless trimming.
    fn take_trailing_blank(
        &mut self,
        collected: &mut Collected,
        trim_trailing_newlines: bool,
        more: impl Fn(&Self) -> bool,
    ) {
        while more(self) && (self.check(LiquidDocTokenType::Newline) || self.at_blank_text_line()) {
            if !trim_trailing_newlines {
                if self.check(LiquidDocTokenType::Newline) {
                    collected.value.push('\n');
                }
                collected.end_pos = self.peek().end;
            }
            self.advance();
        }
    }

    /// Collect text lines and newlines until the next annotation or the end.
    fn collect_content_lines(&mut self, opts: CollectOptions) -> Collected {
        let start_pos = self
            .tokens
            .get(self.p)
            .map_or_else(|| self.tokens[self.p - 1].end, |token| token.start);
        let mut collected = Collected {
            value: String::new(),
            start_pos,
            end_pos: start_pos,
        };

        while !self.is_at_end() {
            let current = self.peek();

            if self.check(LiquidDocTokenType::Annotation) {
                break;
            }

            if self.check(LiquidDocTokenType::Newline) {
                let look_ahead = self.skip_blank_from(self.p + 1);
                let next = self.tokens.get(look_ahead);

                let newline_count = look_ahead - self.p;
                let paragraph_break = next.is_some_and(|la| {
                    la.kind == LiquidDocTokenType::TextLine && !js_trim(la.value).is_empty()
                });
                if opts.stop_at_paragraph_break && newline_count >= 2 && paragraph_break {
                    break;
                }

                if next.is_some_and(|la| la.kind == LiquidDocTokenType::Annotation) {
                    self.take_trailing_blank(&mut collected, opts.trim_trailing_newlines, |me| {
                        me.p < look_ahead
                    });
                    break;
                }

                if next.is_none_or(|la| la.kind == LiquidDocTokenType::EndOfInput) {
                    self.take_trailing_blank(&mut collected, opts.trim_trailing_newlines, |me| {
                        !me.is_at_end()
                    });
                    break;
                }

                collected.value.push('\n');
                collected.end_pos = current.end;
                self.advance();
                continue;
            }

            if self.check(LiquidDocTokenType::TextLine) && js_trim(current.value).is_empty() {
                self.advance();
                continue;
            }

            if collected.value.is_empty() {
                let leading_ws = current.value.len() - js_trim_start(current.value).len();
                collected.start_pos = current.start + leading_ws;
                collected.value.push_str(js_trim_start(current.value));
            } else {
                collected.value.push_str(current.value);
            }
            collected.end_pos = current.end;
            self.advance();
        }

        collected
    }
}

/// TS `const contentStart = value ? startPos : annotationToken.end` and the
/// matching end, `value ? endPos : contentStart`.
fn block_content_range(collected: &Collected, annotation_end: usize) -> (usize, usize) {
    if collected.value.is_empty() {
        return (annotation_end, annotation_end);
    }
    (collected.start_pos, collected.end_pos)
}

struct ParamTokenWalker<'a> {
    tokens: Vec<ParamToken<'a>>,
    p: usize,
}

impl<'a> ParamTokenWalker<'a> {
    fn new(tokens: Vec<ParamToken<'a>>) -> Self {
        Self { tokens, p: 0 }
    }

    fn accept(&mut self, kind: ParamTokenType) -> Option<ParamToken<'a>> {
        if self.tokens[self.p].kind != kind {
            return None;
        }
        Some(self.advance())
    }

    fn check(&self, kind: ParamTokenType) -> bool {
        self.tokens[self.p].kind == kind
    }

    fn is_at_end(&self) -> bool {
        self.check(ParamTokenType::EndOfInput)
    }

    /// Consume the current token unconditionally and advance.
    fn advance(&mut self) -> ParamToken<'a> {
        let token = self.tokens[self.p];
        self.p += 1;
        token
    }
}
