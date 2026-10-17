//! Port of `src/document/liquid-lines.ts`, plus `envelopeFromLine` from
//! `src/shared.ts`, its only caller in the parser.

use crate::ast::LiquidStatement;
use crate::document::base::tokenize_markup_at;
use crate::document::factories::{
    DelimiterWhitespace, LiquidTagEnvelope, make_liquid_branch_named, make_liquid_branch_unnamed,
    make_liquid_raw_tag, make_liquid_tag_base_case, make_liquid_tag_base_case_bare,
    make_liquid_tag_named, make_raw_markup, make_text_node,
};
use crate::document::liquid_blocks::{
    EndTag, finalize_branch, is_branch_name, make_block_tag, parse_block_markup,
    parse_branch_markup_at,
};
use crate::document::liquid_raw::raw_markup_kind_for_tag;
use crate::document::parser::DocumentParser;
use crate::document::tree_builder::{ChildFilterMode, filter_children};
use crate::environment::{TagLookup, tag_for_name};
use crate::errors::ParseError;
use crate::markup::parser::MarkupParser;
use crate::tag_definitions::{BranchName, LiquidLine, LiquidLineContext, TagDefinition, TagParse};
use crate::value::JsVal;

/// The TS `{ start: '', end: '' }` delimiter whitespace of every line tag.
const LINE_WHITESPACE: DelimiterWhitespace = DelimiterWhitespace { start: "", end: "" };

/// TS `envelopeFromLine(line, source)`, `shared.ts:9`.
pub fn envelope_from_line(line: &LiquidLine) -> LiquidTagEnvelope {
    LiquidTagEnvelope {
        tag_name: line.tag_name.clone(),
        markup_string: line.markup.clone(),
        markup_offset: line.markup_offset,
        markup_end: line.markup_offset + line.markup.len(),
        whitespace_start: "",
        whitespace_end: "",
        block_start_position: JsVal::position(line.name_offset, line.line_end),
    }
}

// liquidStatement := tagName markup
pub fn parse_liquid_statement(
    parser: &mut DocumentParser<'_>,
    tag_name: &str,
    markup_string: &str,
    markup_offset: usize,
    ctx: &mut LiquidLineContext,
) -> Result<LiquidStatement, ParseError> {
    let line = &ctx.lines[ctx.index - 1];
    let envelope = envelope_from_line(line);

    if tag_name == "#" {
        // Preserve the inline comment's inner indentation (`preserve_markup`).
        return Ok(make_liquid_tag_base_case(
            &envelope,
            JsVal::Undefined,
            JsVal::Undefined,
            None,
            None,
            true,
        ));
    }

    if tag_name.starts_with("end") {
        return Err(ParseError::parsing(
            format!("Unexpected end tag '{tag_name}' in {{% liquid %}} block"),
            line.name_offset,
            line.line_end,
        ));
    }

    let definition = match tag_for_name(tag_name) {
        TagLookup::Missing => return Ok(make_liquid_tag_base_case_bare(&envelope, None)),
        // TS assertNever(def), utils.ts:4: no Object.prototype value has a type
        TagLookup::ProtoKey => return Err(ParseError::error("Unexpected object: undefined")),
        TagLookup::Builtin(definition) => definition,
    };

    match definition {
        TagDefinition::Tag { parse } => Ok(parse_line_standalone_tag(
            parser,
            *parse,
            &envelope,
            tag_name,
            markup_string,
            markup_offset,
        )),
        TagDefinition::Block { parse, branches } => parse_line_block_tag(
            parser,
            *parse,
            branches,
            &envelope,
            markup_string,
            markup_offset,
            ctx,
        ),
        TagDefinition::Raw { .. } => parse_line_raw_tag(parser, &envelope, ctx),
    }
}

/// The `TagKind.Tag` arm of TS `parseLiquidStatement`.
fn parse_line_standalone_tag(
    parser: &mut DocumentParser<'_>,
    parse: TagParse,
    envelope: &LiquidTagEnvelope,
    tag_name: &str,
    markup_string: &str,
    markup_offset: usize,
) -> JsVal {
    let source = parser.source;
    let tokens = tokenize_markup_at(markup_string, markup_offset);
    let mut markup_parser = MarkupParser::new(
        tokens,
        source,
        Some(markup_offset),
        Some(envelope.markup_end),
    );
    if parser.is_tolerant() {
        markup_parser.enable_tolerant();
    }

    match parse(tag_name, &mut markup_parser, parser) {
        Ok(_) if !markup_parser.is_at_end() => make_liquid_tag_base_case(
            envelope,
            JsVal::Undefined,
            JsVal::Undefined,
            None,
            Some("unexpected tokens after markup".to_string()),
            false,
        ),
        Ok(markup) => {
            make_liquid_tag_named(envelope, markup, JsVal::Undefined, JsVal::Undefined, None)
        }
        Err(e) => make_liquid_tag_base_case_bare(envelope, Some(e.message().to_string())),
    }
}

// lineBlockTag := tagName markup LF lineBlockBody | lineBranchedBody "end" tagName
pub fn parse_line_block_tag(
    parser: &mut DocumentParser<'_>,
    parse: TagParse,
    branches: &[BranchName],
    envelope: &LiquidTagEnvelope,
    markup_string: &str,
    markup_offset: usize,
    ctx: &mut LiquidLineContext,
) -> Result<JsVal, ParseError> {
    let block_markup = parse_block_markup(
        parser,
        parse,
        &envelope.tag_name,
        markup_string,
        markup_offset,
    );

    // 'end' + tagName, counted in UTF-16 units as TS `.length` is. When the
    // block is unclosed, TS adds it to the last line's trimmed end, where
    // `end<tagName>` is not source text, so it cannot be added as bytes.
    let end_tag_units = 3 + envelope.tag_name.encode_utf16().count();

    let (children, end_name_offset) = if branches.is_empty() {
        parse_line_block_body(parser, &envelope.tag_name, ctx)?
    } else {
        parse_line_branched_body(parser, &envelope.tag_name, branches, ctx)?
    };
    let end = EndTag {
        position: JsVal::position_plus_units(end_name_offset, end_tag_units),
        whitespace: LINE_WHITESPACE,
    };
    Ok(make_block_tag(envelope, block_markup, children, end))
}

/// TS `ctx.index > 0 && ctx.index <= ctx.lines.length`: the line that opened
/// the raw tag.
fn opening_line(ctx: &LiquidLineContext) -> Option<&LiquidLine> {
    (ctx.index > 0 && ctx.index <= ctx.lines.len()).then(|| &ctx.lines[ctx.index - 1])
}

/// The index of the line that closes the raw tag `tag_name`.
fn find_line_raw_end(ctx: &LiquidLineContext, tag_name: &str) -> Option<usize> {
    let end_tag_name = format!("end{tag_name}");

    // `comment`/`doc` bodies balance nested opens of the same tag, and a
    // nested `raw` block is carved out. Every other raw tag is first-match.
    let balanced = tag_name == "comment" || tag_name == "doc";
    if !balanced {
        return (ctx.index..ctx.lines.len()).find(|&i| ctx.lines[i].tag_name == end_tag_name);
    }

    let mut depth = 0;
    let mut i = ctx.index;
    while i < ctx.lines.len() {
        let name = ctx.lines[i].tag_name.as_str();
        if name == "raw" {
            // Skip past the nested raw block; its body lines never affect depth.
            i += 1;
            while i < ctx.lines.len() && ctx.lines[i].tag_name != "endraw" {
                i += 1;
            }
            i += 1;
            continue;
        }
        if name == tag_name {
            depth += 1;
        } else if name == end_tag_name {
            if depth == 0 {
                return Some(i);
            }
            depth -= 1;
        }
        i += 1;
    }
    None
}

// lineRawTag := tagName LF line* "end" tagName
pub fn parse_line_raw_tag(
    parser: &mut DocumentParser<'_>,
    envelope: &LiquidTagEnvelope,
    ctx: &mut LiquidLineContext,
) -> Result<JsVal, ParseError> {
    let tag_name = envelope.tag_name.as_str();
    let end_tag_name_length = 3 + tag_name.len(); // `end${tagName}`.length

    // The RawMarkup position starts at the opening line's lineEnd, and the
    // body string one character later, skipping the `\n`.
    let block_start_end = envelope.block_start_position.get("end").offset();
    let position_start_offset = opening_line(ctx).map_or(block_start_end, |line| line.line_end);
    // TS `lineEnd + 1` steps one UTF-16 unit, which is one whole char here:
    // `\n` or trimmed JS whitespace, all BMP. Per round 6 D6.
    let body_content_start = opening_line(ctx).map_or(block_start_end, |line| {
        line.line_end
            + parser.source[line.line_end..]
                .chars()
                .next()
                .map_or(1, char::len_utf8)
    });

    let Some(end_line_index) = find_line_raw_end(ctx, tag_name) else {
        return Err(ParseError::parsing(
            format!("Unclosed raw tag '{tag_name}' in {{% liquid %}} block"),
            envelope.block_start_position.get("start").offset(),
            block_start_end,
        ));
    };

    let end_line = &ctx.lines[end_line_index];
    let body_end_offset = end_line.name_offset;
    let end_name_offset = end_line.name_offset;
    let source = parser.source;
    // JS `slice` returns '' when start is after end.
    let body_string = if body_content_start < body_end_offset {
        &source[body_content_start..body_end_offset]
    } else {
        ""
    };

    // A TextNode wrapping the body content, matching the non-liquid path in
    // `parse_raw_tag_body`.
    let body_nodes = if body_content_start < body_end_offset {
        let text_node = make_text_node(body_string, body_content_start, body_end_offset);
        filter_children(ChildFilterMode::Syntactic, vec![text_node], source)
    } else {
        Vec::new()
    };

    let body = make_raw_markup(
        raw_markup_kind_for_tag(tag_name, body_string),
        body_string,
        body_nodes,
        position_start_offset,
        body_end_offset,
    );

    let end_position = JsVal::position(end_name_offset, end_name_offset + end_tag_name_length);
    ctx.index = end_line_index + 1;

    Ok(make_liquid_raw_tag(
        envelope,
        source,
        body,
        end_position,
        LINE_WHITESPACE,
    ))
}

/// TS `ctx.lines.length > 0 ? ctx.lines[ctx.lines.length - 1].lineEnd : 0`.
fn last_line_end(ctx: &LiquidLineContext) -> usize {
    ctx.lines.last().map_or(0, |line| line.line_end)
}

fn unclosed_line_block_error(parent_name: &str) -> ParseError {
    ParseError::parsing(
        format!("Unclosed block tag '{parent_name}' in {{% liquid %}} block"),
        0,
        0,
    )
}

/// Parses the statement on line `ctx.index` after advancing past it.
fn parse_next_statement(
    parser: &mut DocumentParser<'_>,
    ctx: &mut LiquidLineContext,
) -> Result<LiquidStatement, ParseError> {
    let line = &ctx.lines[ctx.index];
    let tag_name = line.tag_name.clone();
    let markup = line.markup.clone();
    let markup_offset = line.markup_offset;
    ctx.index += 1;
    parse_liquid_statement(parser, &tag_name, &markup, markup_offset, ctx)
}

// lineBlockBody := liquidStatement* "end" tagName
pub fn parse_line_block_body(
    parser: &mut DocumentParser<'_>,
    parent_name: &str,
    ctx: &mut LiquidLineContext,
) -> Result<(Vec<JsVal>, usize), ParseError> {
    let end_name = format!("end{parent_name}");
    let mut children = Vec::new();

    while ctx.index < ctx.lines.len() {
        let line = &ctx.lines[ctx.index];

        if line.tag_name == end_name {
            let end_name_offset = line.name_offset;
            ctx.index += 1;
            return Ok((children, end_name_offset));
        }

        children.push(parse_next_statement(parser, ctx)?);
    }

    if parser.allow_unclosed_document_node {
        return Ok((children, last_line_end(ctx)));
    }

    Err(unclosed_line_block_error(parent_name))
}

fn line_child_filter_mode(parser: &DocumentParser<'_>) -> ChildFilterMode {
    if parser.parse_html {
        ChildFilterMode::StripEdges
    } else {
        ChildFilterMode::Syntactic
    }
}

// lineBranchedBody := lineBranch+ "end" tagName
pub fn parse_line_branched_body(
    parser: &mut DocumentParser<'_>,
    parent_name: &str,
    definition_branches: &[BranchName],
    ctx: &mut LiquidLineContext,
) -> Result<(Vec<JsVal>, usize), ParseError> {
    let end_name = format!("end{parent_name}");
    let mut branches = Vec::new();
    let body_start = if ctx.index > 0 {
        ctx.lines[ctx.index - 1].line_end
    } else {
        0
    };
    let mut current_branch = make_liquid_branch_unnamed(body_start);
    let mut current_children: Vec<JsVal> = Vec::new();

    while ctx.index < ctx.lines.len() {
        let line = &ctx.lines[ctx.index];

        if line.tag_name == end_name {
            let end_name_offset = line.name_offset;
            finalize_branch(
                &current_branch,
                current_children,
                end_name_offset,
                parser.source,
                line_child_filter_mode(parser),
            );
            branches.push(current_branch);
            ctx.index += 1;
            return Ok((branches, end_name_offset));
        }

        let branch_name =
            is_branch_name(&line.tag_name).filter(|name| definition_branches.contains(name));
        if let Some(branch_name) = branch_name {
            finalize_branch(
                &current_branch,
                std::mem::take(&mut current_children),
                line.name_offset,
                parser.source,
                line_child_filter_mode(parser),
            );
            branches.push(current_branch);

            let branch_envelope = envelope_from_line(line);
            let branch_markup = parse_line_branch_markup(
                branch_name,
                &branch_envelope,
                parser.source,
                parser.is_tolerant(),
            );
            current_branch = make_liquid_branch_named(&branch_envelope, branch_markup);
            ctx.index += 1;
            continue;
        }

        current_children.push(parse_next_statement(parser, ctx)?);
    }

    if parser.allow_unclosed_document_node {
        let end_name_offset = last_line_end(ctx);
        finalize_branch(
            &current_branch,
            current_children,
            end_name_offset,
            parser.source,
            line_child_filter_mode(parser),
        );
        branches.push(current_branch);
        return Ok((branches, end_name_offset));
    }

    Err(unclosed_line_block_error(parent_name))
}

pub fn parse_line_branch_markup(
    branch_name: BranchName,
    envelope: &LiquidTagEnvelope,
    source: &str,
    tolerant: bool,
) -> JsVal {
    parse_branch_markup_at(
        branch_name,
        envelope,
        envelope.markup_offset,
        source,
        tolerant,
    )
}
