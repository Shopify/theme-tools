//! Port of `tags/liquid.ts` (line splitting) and `document/liquid-lines.ts`.

use std::borrow::Cow;

use liquid_ast::*;

use crate::markup::{MarkupParser, PResult};
use crate::parser::{
    base_markup, branch_markup, error, filter_children, finalize_branch, finish_tag,
    make_branch_named, make_branch_unnamed, make_raw_tag, make_tag, raw_markup_kind_for_tag, slice,
    text_node, Envelope, FilterMode, Parser,
};
use crate::tags::{self, TagKind};
use crate::{js_find_space, js_trim_end, js_trim_start};

/// `LiquidLine`; strings are slices of the source.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct LiquidLine<'a> {
    pub tag_name: &'a str,
    pub markup: &'a str,
    pub markup_offset: usize,
    pub name_offset: usize,
    pub line_end: usize,
}

/// `/^\w+\s*:/`
fn looks_like_named_argument(s: &str) -> bool {
    let word = s
        .bytes()
        .take_while(|b| b.is_ascii_alphanumeric() || *b == b'_')
        .count();
    word > 0 && js_trim_start(&s[word..]).starts_with(':')
}

/// `parseLines`
pub(crate) fn parse_lines(body: &str, body_start: usize) -> Vec<LiquidLine<'_>> {
    // Logical lines as (start in body, end in body): a line continues the previous one when
    // that ends with `,` and this one starts like a named argument.
    let mut joined: Vec<(usize, usize)> = Vec::new();
    let mut offset = 0;
    for raw_line in body.split('\n') {
        let end = offset + raw_line.len();
        let trimmed = js_trim_start(raw_line);
        match joined.last_mut() {
            Some(prev)
                if !trimmed.is_empty()
                    && js_trim_end(&body[prev.0..prev.1]).ends_with(',')
                    && looks_like_named_argument(trimmed) =>
            {
                prev.1 = end
            }
            _ => joined.push((offset, end)),
        }
        offset = end + 1;
    }

    let mut lines = Vec::new();
    for (s, e) in joined {
        let raw = &body[s..e];
        let start = body_start + s;
        let trimmed = js_trim_start(raw);
        if trimmed.is_empty() {
            continue;
        }
        let leading = raw.len() - trimmed.len();
        let line_end = match raw.rfind('\n') {
            None => start + js_trim_end(raw).len(),
            Some(nl) => start + nl + 1 + js_trim_end(&raw[nl + 1..]).len(),
        };
        let first_line = trimmed.split('\n').next().unwrap();
        let name_offset = start + leading;
        let (tag_name, markup, markup_offset) = if first_line.starts_with('#') {
            let after = &trimmed[1..];
            let markup = after.strip_prefix([' ', '\t']).unwrap_or(after);
            ("#", markup, name_offset + 1 + (after.len() - markup.len()))
        } else {
            match js_find_space(first_line) {
                None => (first_line, "", name_offset + first_line.len()),
                Some(ws) => {
                    let rest = &trimmed[ws..];
                    let markup = js_trim_start(rest);
                    (
                        &first_line[..ws],
                        markup,
                        name_offset + ws + (rest.len() - markup.len()),
                    )
                }
            }
        };
        lines.push(LiquidLine {
            tag_name,
            markup,
            markup_offset,
            name_offset,
            line_end,
        });
    }
    lines
}

fn envelope_from_line<'a>(line: &LiquidLine<'a>) -> Envelope<'a> {
    Envelope {
        tag_name: line.tag_name,
        markup_string: line.markup,
        markup_offset: line.markup_offset,
        markup_end: line.markup_offset + line.markup.len(),
        whitespace_start: false,
        whitespace_end: false,
        block_start_position: Position::new(line.name_offset, line.line_end),
    }
}

struct LineContext<'a> {
    lines: Vec<LiquidLine<'a>>,
    index: usize,
}

impl<'a> Parser<'a> {
    /// `liquidTag.parse`
    pub(crate) fn parse_liquid_tag_body(
        &mut self,
        m: &mut MarkupParser<'a>,
    ) -> PResult<Markup<'a>> {
        let (start, end) = m.body_context();
        let mut ctx = LineContext {
            lines: parse_lines(slice(self.source, start, end), start),
            index: 0,
        };
        let mut statements = Vec::with_capacity(ctx.lines.len());
        while ctx.index < ctx.lines.len() {
            ctx.index += 1;
            statements.push(self.parse_liquid_statement(&mut ctx)?);
        }
        Ok(Markup::Nodes(statements))
    }

    /// `parseLiquidStatement` for `ctx.lines[ctx.index - 1]`.
    fn parse_liquid_statement(&mut self, ctx: &mut LineContext<'a>) -> PResult<Node<'a>> {
        let line = ctx.lines[ctx.index - 1];
        let env = envelope_from_line(&line);
        let tag_name = line.tag_name;
        if tag_name == "#" {
            let markup = Markup::Str(Cow::Borrowed(env.markup_string));
            return Ok(Node::LiquidTag(make_tag(&env, markup, None, None, None)));
        }
        if tag_name.starts_with("end") {
            return Err(error(
                format!("Unexpected end tag '{tag_name}' in {{% liquid %}} block"),
                line.name_offset,
                line.line_end,
            ));
        }
        Ok(match tags::tag_for_name(tag_name) {
            None => Node::LiquidTag(make_tag(&env, base_markup(&env), None, None, None)),
            Some(TagKind::Tag) => {
                let markup = self.parse_tag_markup(tag_name, line.markup, line.markup_offset);
                Node::LiquidTag(finish_tag(&env, markup, None, None))
            }
            Some(TagKind::Block) => Node::LiquidTag(self.parse_line_block_tag(&env, ctx)?),
            Some(TagKind::Raw) => Node::LiquidRawTag(self.parse_line_raw_tag(&env, ctx)?),
            Some(TagKind::Proto) => return Err(tags::proto_error()),
        })
    }

    fn parse_line_block_tag(
        &mut self,
        env: &Envelope<'a>,
        ctx: &mut LineContext<'a>,
    ) -> PResult<LiquidTag<'a>> {
        let markup = self.parse_tag_markup(env.tag_name, env.markup_string, env.markup_offset);
        let (children, end_position) = self.nested(|p| {
            Ok(if tags::branches(env.tag_name).is_empty() {
                p.parse_line_block_body(env.tag_name, ctx)?
            } else {
                let (branches, end) = p.parse_line_branched_body(env.tag_name, ctx)?;
                (branches.into_iter().map(Node::LiquidBranch).collect(), end)
            })
        })?;
        let end = (end_position, false, false);
        Ok(finish_tag(env, markup, Some(children), Some(end)))
    }

    fn parse_line_raw_tag(
        &mut self,
        env: &Envelope<'a>,
        ctx: &mut LineContext<'a>,
    ) -> PResult<LiquidRawTag<'a>> {
        let tag_name = env.tag_name;
        let end_name = format!("end{tag_name}");
        let position_start = ctx.lines[ctx.index - 1].line_end;
        let content_start = position_start + 1;

        let lines = &ctx.lines;
        let mut end_index = None;
        if tag_name == "comment" || tag_name == "doc" {
            let mut depth = 0usize;
            let mut i = ctx.index;
            while i < lines.len() {
                let name = lines[i].tag_name;
                if name == "raw" {
                    i += 1;
                    while i < lines.len() && lines[i].tag_name != "endraw" {
                        i += 1;
                    }
                    i += 1;
                    continue;
                }
                if name == tag_name {
                    depth += 1;
                } else if name == end_name {
                    if depth == 0 {
                        end_index = Some(i);
                        break;
                    }
                    depth -= 1;
                }
                i += 1;
            }
        } else {
            end_index = (ctx.index..lines.len()).find(|&i| lines[i].tag_name == end_name);
        }
        let Some(end_index) = end_index else {
            let bsp = env.block_start_position;
            return Err(error(
                format!("Unclosed raw tag '{tag_name}' in {{% liquid %}} block"),
                bsp.start,
                bsp.end,
            ));
        };

        let end_line = lines[end_index];
        let body_end = end_line.name_offset;
        let body = slice(self.source, content_start, body_end);
        let nodes = if content_start < body_end {
            filter_children(
                self.source,
                FilterMode::Syntactic,
                vec![text_node(self.source, content_start, body_end)],
            )
        } else {
            Vec::new()
        };
        let raw = RawMarkup {
            kind: raw_markup_kind_for_tag(tag_name, body),
            value: Cow::Borrowed(body),
            nodes,
            position: Position::new(position_start, body_end),
        };
        ctx.index = end_index + 1;
        let end = (
            Position::new(end_line.name_offset, end_line.name_offset + end_name.len()),
            false,
            false,
        );
        Ok(make_raw_tag(self.source, env, raw, end))
    }

    fn unclosed_line_block(&self, parent: &str, ctx: &LineContext<'a>) -> PResult<usize> {
        if self.allow_unclosed_document_node {
            return Ok(ctx.lines.last().map_or(0, |l| l.line_end));
        }
        Err(error(
            format!("Unclosed block tag '{parent}' in {{% liquid %}} block"),
            0,
            0,
        ))
    }

    fn parse_line_block_body(
        &mut self,
        parent: &str,
        ctx: &mut LineContext<'a>,
    ) -> PResult<(Vec<Node<'a>>, Position)> {
        let mut children = Vec::new();
        while ctx.index < ctx.lines.len() {
            let line = ctx.lines[ctx.index];
            ctx.index += 1;
            if line.tag_name.strip_prefix("end") == Some(parent) {
                let end = Position::new(line.name_offset, line.name_offset + line.tag_name.len());
                return Ok((children, end));
            }
            children.push(self.parse_liquid_statement(ctx)?);
        }
        let end = self.unclosed_line_block(parent, ctx)?;
        Ok((children, Position::new(end, end)))
    }

    fn parse_line_branched_body(
        &mut self,
        parent: &str,
        ctx: &mut LineContext<'a>,
    ) -> PResult<(Vec<LiquidBranch<'a>>, Position)> {
        let allowed = tags::branches(parent);
        let mode = if self.parse_html {
            FilterMode::StripEdges
        } else {
            FilterMode::Syntactic
        };
        let body_start = if ctx.index > 0 {
            ctx.lines[ctx.index - 1].line_end
        } else {
            0
        };
        let mut branches = Vec::new();
        let mut current = make_branch_unnamed(body_start);
        let mut children = Vec::new();
        while ctx.index < ctx.lines.len() {
            let line = ctx.lines[ctx.index];
            ctx.index += 1;
            if line.tag_name.strip_prefix("end") == Some(parent) {
                finalize_branch(self.source, &mut current, children, line.name_offset, mode);
                branches.push(current);
                let end = Position::new(line.name_offset, line.name_offset + line.tag_name.len());
                return Ok((branches, end));
            }
            if tags::is_branch_name(line.tag_name) && allowed.contains(&line.tag_name) {
                finalize_branch(
                    self.source,
                    &mut current,
                    std::mem::take(&mut children),
                    line.name_offset,
                    mode,
                );
                branches.push(current);
                let env = envelope_from_line(&line);
                let markup =
                    branch_markup(self.source, line.tag_name, line.markup, line.markup_offset);
                current = make_branch_named(&env, markup);
                continue;
            }
            children.push(self.parse_liquid_statement(ctx)?);
        }
        let end = self.unclosed_line_block(parent, ctx)?;
        finalize_branch(self.source, &mut current, children, end, mode);
        branches.push(current);
        Ok((branches, Position::new(end, end)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_and_joins_lines() {
        let body = "\n  render 'a',\n    b: 1\n  # x\n  echo";
        let lines = parse_lines(body, 10);
        assert_eq!(lines.len(), 3);
        assert_eq!(
            (lines[0].tag_name, lines[0].markup),
            ("render", "'a',\n    b: 1")
        );
        assert_eq!(
            (
                lines[0].name_offset,
                lines[0].markup_offset,
                lines[0].line_end
            ),
            (13, 20, 33)
        );
        assert_eq!(
            (lines[1].tag_name, lines[1].markup, lines[1].markup_offset),
            ("#", "x", 38)
        );
        assert_eq!(
            (lines[2].tag_name, lines[2].markup, lines[2].markup_offset),
            ("echo", "", 46)
        );
    }
}
