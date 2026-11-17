//! Port of `document/{base,parser,node-dispatch,factories,tree-builder,liquid-tags,
//! liquid-variable-output,liquid-blocks,liquid-raw}.ts`.

use std::borrow::Cow;

use liquid_ast::*;

use crate::markup::{tokenize_markup, MarkupParser, PResult};
use crate::raw_body::{find_raw_body_end, rule_for};
use crate::tags::{self, TagKind};
use crate::tokenizer::{
    tokenize_slice, tokenize_with, RawBodyEnds, RawTags, Token, TokenType as TT, TokenizeOptions,
};
use crate::{
    first_word, grow_stack, is_js_space, js_trim, js_trim_end, js_trim_start, ParseError, MAX_DEPTH,
};

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum FilterMode {
    Syntactic,
    Preserve,
    StripEdges,
}

/// `LiquidTagEnvelope`. All strings are slices of the source.
#[derive(Clone, Copy)]
pub(crate) struct Envelope<'a> {
    pub tag_name: &'a str,
    pub markup_string: &'a str,
    pub markup_offset: usize,
    pub markup_end: usize,
    pub trim_start: bool,
    pub trim_end: bool,
    pub start_tag: Span,
}

/// A block's end tag: `blockEndPosition` and its `{ start, end }` delimiter whitespace.
pub(crate) type BlockEnd = (Span, bool, bool);

pub(crate) struct Parser<'a> {
    pub source: &'a str,
    pub tokens: Vec<Token>,
    /// Where the tokenizer found raw bodies to end. Gone once tokens are re-tokenized.
    raw_body_ends: RawBodyEnds,
    pub p: usize,
    pub parse_html: bool,
    pub allow_unclosed_html: bool,
    pub allow_unclosed_document_node: bool,
    pub in_attribute_context: bool,
    pub in_attribute_value_context: bool,
    /// Blocks and elements open around `p`.
    pub depth: usize,
    /// The `<!--` of the comment the parser is inside.
    pub open_html_comment: Option<Span>,
}

pub(crate) fn error(message: String, start: usize, end: usize) -> ParseError {
    ParseError::liquid(message, start, end)
}

/// JS `source.slice(start, end)`: empty when `start >= end`.
pub(crate) fn slice(source: &str, start: usize, end: usize) -> &str {
    if start >= end {
        ""
    } else {
        &source[start..end]
    }
}

pub(crate) fn text_node(source: &str, start: usize, end: usize) -> Node<'_> {
    Node::TextNode(TextNode {
        value: Cow::Borrowed(&source[start..end]),
        span: Span::new(start, end),
    })
}

pub(crate) fn base_markup<'a>(env: &Envelope<'a>) -> Markup<'a> {
    Markup::Str(Cow::Borrowed(js_trim(env.markup_string)))
}

/// `makeLiquidTagNamed` / `makeLiquidTagBaseCase` (the caller picks `markup`).
pub(crate) fn make_tag<'a>(
    env: &Envelope<'a>,
    markup: Markup<'a>,
    children: Option<Vec<Node<'a>>>,
    end: Option<BlockEnd>,
    reason: Option<Str<'a>>,
) -> LiquidTag<'a> {
    let bsp = env.start_tag;
    LiquidTag {
        name: Cow::Borrowed(env.tag_name),
        markup,
        children,
        trim_start: env.trim_start,
        trim_end: env.trim_end,
        end_trim_start: end.map(|e| e.1),
        end_trim_end: end.map(|e| e.2),
        start_tag: bsp,
        end_tag: end.map(|e| e.0),
        markup_span: Span::new(env.markup_offset, env.markup_end),
        span: Span::new(bsp.start, end.map_or(bsp.end, |e| e.0.end)),
        reason,
    }
}

/// Named when the markup parsed, else the base case carrying the failure reason.
pub(crate) fn finish_tag<'a>(
    env: &Envelope<'a>,
    markup: Result<Markup<'a>, Str<'a>>,
    children: Option<Vec<Node<'a>>>,
    end: Option<BlockEnd>,
) -> LiquidTag<'a> {
    match markup {
        Ok(m) => make_tag(env, m, children, end, None),
        Err(reason) => make_tag(env, base_markup(env), children, end, Some(reason)),
    }
}

pub(crate) fn make_branch_unnamed<'a>(body_start: usize) -> LiquidBranch<'a> {
    let at = Span::new(body_start, body_start);
    LiquidBranch {
        name: None,
        markup: Markup::Str(Cow::Borrowed("")),
        children: Vec::new(),
        trim_start: false,
        trim_end: false,
        markup_span: at,
        start_tag: at,
        end_tag: Span::default(), // Set by `finalize_branch`.
        span: at,
    }
}

pub(crate) fn make_branch_named<'a>(env: &Envelope<'a>, markup: Markup<'a>) -> LiquidBranch<'a> {
    LiquidBranch {
        name: Some(Cow::Borrowed(env.tag_name)),
        markup,
        children: Vec::new(),
        trim_start: env.trim_start,
        trim_end: env.trim_end,
        markup_span: Span::new(env.markup_offset, env.markup_end),
        start_tag: env.start_tag,
        end_tag: Span::default(), // Set by `finalize_branch`.
        span: env.start_tag,
    }
}

pub(crate) fn make_raw_tag<'a>(
    source: &'a str,
    env: &Envelope<'a>,
    body: RawMarkup<'a>,
    end: BlockEnd,
) -> LiquidRawTag<'a> {
    let b = source.as_bytes();
    let mut markup_end = env.markup_end;
    while markup_end > env.markup_offset && matches!(b[markup_end - 1], b' ' | b'\t') {
        markup_end -= 1;
    }
    LiquidRawTag {
        name: Cow::Borrowed(env.tag_name),
        markup: Cow::Borrowed(js_trim(env.markup_string)),
        markup_span: Span::new(env.markup_offset, markup_end),
        body,
        trim_start: env.trim_start,
        trim_end: env.trim_end,
        end_trim_start: end.1,
        end_trim_end: end.2,
        start_tag: env.start_tag,
        end_tag: end.0,
        span: Span::new(env.start_tag.start, end.0.end),
    }
}

/// `finalizeBranch`
pub(crate) fn finalize_branch<'a>(
    source: &'a str,
    branch: &mut LiquidBranch<'a>,
    children: Vec<Node<'a>>,
    end_pos: usize,
    mode: FilterMode,
) {
    // The last merged child ends where the last child does.
    let last_end = children.last().map(|c| c.span().end);
    branch.children = filter_children(source, mode, children);
    branch.end_tag = Span::new(end_pos, end_pos);
    branch.span.end = end_pos;
    if let Some(e) = last_end {
        if e > end_pos {
            branch.span.end = e;
        }
    }
}

/// Branch markup for `elsif` / `when` (`parseBranchMarkup` / `parseLineBranchMarkup`).
pub(crate) fn branch_markup<'a>(
    source: &'a str,
    name: &str,
    markup: &'a str,
    start: usize,
) -> Markup<'a> {
    if name != "elsif" && name != "when" {
        return Markup::Str(Cow::Borrowed(""));
    }
    let mut m = MarkupParser::new(tokenize_markup(markup, start), source);
    let result = if name == "elsif" {
        m.conditional_expression()
            .map(|n| Markup::Node(Box::new(n)))
    } else {
        tags::parse_when(&mut m).map(Markup::Nodes)
    };
    match result {
        Ok(r) if m.is_at_end() => r,
        _ => Markup::Str(Cow::Borrowed(js_trim(markup))),
    }
}

pub(crate) fn raw_markup_kind_for_tag(tag_name: &str, body: &str) -> &'static str {
    match tag_name {
        "javascript" => "javascript",
        "stylesheet" | "style" => {
            if crate::has_liquid_open(body) {
                "text"
            } else {
                "css"
            }
        }
        "schema" => "json",
        _ => "text",
    }
}

fn mergeable_text<'a>(n: &Node<'a>) -> Option<Span> {
    match n {
        Node::TextNode(t) => Some(t.span),
        _ => None,
    }
}

/// `mergeAdjacentTextNodes`
pub(crate) fn merge_adjacent_text_nodes<'a>(
    source: &'a str,
    nodes: Vec<Node<'a>>,
) -> Vec<Node<'a>> {
    if nodes.len() <= 1 {
        return nodes;
    }
    let mut result = Vec::with_capacity(nodes.len());
    // First text node of the current run, and the end of its last node when the run has more.
    let mut run: Option<(Node<'a>, Option<usize>)> = None;
    let flush = |run: &mut Option<(Node<'a>, Option<usize>)>, result: &mut Vec<Node<'a>>| match run
        .take()
    {
        Some((first, None)) => result.push(first),
        Some((first, Some(end))) => result.push(text_node(source, first.span().start, end)),
        None => {}
    };
    for node in nodes {
        if let Some(pos) = mergeable_text(&node) {
            match &mut run {
                None => run = Some((node, None)),
                Some((_, end)) => *end = Some(pos.end),
            }
        } else {
            flush(&mut run, &mut result);
            result.push(node);
        }
    }
    flush(&mut run, &mut result);
    result
}

fn is_whitespace_only_text(n: &Node) -> bool {
    matches!(n, Node::TextNode(t) if !t.value.is_empty() && t.value.chars().all(is_js_space))
}

/// `filterChildren`
pub(crate) fn filter_children<'a>(
    source: &'a str,
    mode: FilterMode,
    nodes: Vec<Node<'a>>,
) -> Vec<Node<'a>> {
    let mut merged = merge_adjacent_text_nodes(source, nodes);
    match mode {
        FilterMode::Preserve => merged,
        FilterMode::StripEdges => {
            let end = merged.len()
                - merged
                    .iter()
                    .rev()
                    .take_while(|n| is_whitespace_only_text(n))
                    .count();
            merged.truncate(end);
            let start = merged
                .iter()
                .take_while(|n| is_whitespace_only_text(n))
                .count();
            merged.drain(..start);
            merged
        }
        FilterMode::Syntactic => {
            // After merging, a text node never has a text neighbour: both edges get trimmed.
            merged.retain_mut(|n| {
                let Node::TextNode(t) = n else { return true };
                let v: &str = &t.value;
                let lead = v.len() - js_trim_start(v).len();
                let kept = js_trim_end(&v[lead..]).len();
                if kept == 0 {
                    return false;
                }
                if kept != v.len() {
                    t.value = match &t.value {
                        Cow::Borrowed(s) => Cow::Borrowed(&s[lead..lead + kept]),
                        Cow::Owned(s) => Cow::Owned(s[lead..lead + kept].to_owned()),
                    };
                    t.span = Span::new(t.span.start + lead, t.span.start + lead + kept);
                }
                true
            });
            merged
        }
    }
}

/// `compoundNamesMatch`
pub(crate) fn compound_names_match(source: &str, a: &[Node], b: &[Node]) -> bool {
    let wholly_liquid =
        |s: &[Node]| s.len() == 1 && matches!(s[0], Node::LiquidTag(_) | Node::LiquidRawTag(_));
    if wholly_liquid(a) && wholly_liquid(b) {
        return true;
    }
    if a.len() != b.len() {
        return false;
    }
    let lvo_markup = |o: &'_ LiquidVariableOutput| -> String {
        match &o.markup {
            Markup::Node(n) => match &**n {
                Node::LiquidVariable(v) => v.raw_source.to_string(),
                _ => String::new(),
            },
            m => m.as_str().unwrap_or("").to_string(),
        }
    };
    a.iter().zip(b).all(|(x, y)| {
        x.kind() == y.kind()
            && match (x, y) {
                (Node::TextNode(x), Node::TextNode(y)) => x.value == y.value,
                (Node::LiquidVariableOutput(x), Node::LiquidVariableOutput(y)) => {
                    lvo_markup(x) == lvo_markup(y)
                }
                _ => {
                    let (px, py) = (x.span(), y.span());
                    source[px.start..px.end] == source[py.start..py.end]
                }
            }
    })
}

pub(crate) fn parse_document(
    source: &str,
    parse_html: bool,
    allow_unclosed_document_node: bool,
) -> PResult<Document<'_>> {
    let options = TokenizeOptions {
        raw_tags: RawTags::Builtin,
        parse_html,
        ..TokenizeOptions::default()
    };
    let (tokens, raw_body_ends) = tokenize_with(source, options);
    let mut p = Parser {
        source,
        tokens,
        raw_body_ends,
        p: 0,
        parse_html,
        allow_unclosed_html: allow_unclosed_document_node,
        allow_unclosed_document_node,
        in_attribute_context: false,
        in_attribute_value_context: false,
        depth: 0,
        open_html_comment: None,
    };
    let mut children = Vec::new();
    while !p.is_at_end() {
        children.push(p.parse_node()?);
    }
    Ok(Document {
        children: filter_children(source, FilterMode::Syntactic, children),
        span: Span::new(0, source.len()),
    })
}

impl<'a> Parser<'a> {
    // --- base.ts

    pub(crate) fn consume(&mut self, kind: TT) -> PResult<Token> {
        let t = self.peek();
        if t.kind != kind {
            return Err(error(
                format!("Expected {} but got {}", kind.as_str(), t.kind.as_str()),
                t.start,
                t.end,
            ));
        }
        self.p += 1;
        Ok(t)
    }

    pub(crate) fn accept(&mut self, kind: TT) -> Option<Token> {
        let t = self.peek();
        if t.kind != kind {
            return None;
        }
        self.p += 1;
        Some(t)
    }

    pub(crate) fn check(&self, kind: TT, ahead: usize) -> bool {
        self.kind_at(self.p + ahead) == Some(kind)
    }

    pub(crate) fn peek(&self) -> Token {
        self.tokens[self.p]
    }

    pub(crate) fn is_at_end(&self) -> bool {
        self.peek().kind == TT::EndOfInput
    }

    pub(crate) fn has_token(&self, i: usize) -> bool {
        i < self.tokens.len()
    }

    pub(crate) fn kind_at(&self, i: usize) -> Option<TT> {
        self.tokens.get(i).map(|t| t.kind)
    }

    pub(crate) fn seek_to_source_offset(&mut self, offset: usize) {
        self.p = self.tokens.partition_point(|t| t.start < offset);
    }

    /// `retokenizeRawText`: tokenizes the `<script>` or `<style>` body `body_start..body_end` as
    /// raw text, then its close tag up to `close_end` and the rest of the source as a document,
    /// keeping the old tokens after the close tag when they already resume there. Leaves the
    /// cursor at the first body token.
    pub(crate) fn retokenize_raw_text(
        &mut self,
        body_start: usize,
        body_end: usize,
        close_end: usize,
    ) {
        self.raw_body_ends.clear();
        let source = self.source;
        let prefix = self.tokens.partition_point(|t| t.end <= body_start);
        let close = self
            .tokens
            .iter()
            .position(|t| t.kind == TT::HtmlTagClose && t.end == close_end)
            .filter(|&i| self.tokens.get(i + 1).is_some_and(|t| t.start == close_end));
        let mut tokens = self.tokens[..prefix].to_vec();
        tokens.extend(tokenize_slice(source, body_start, body_end, true, false));
        match close {
            Some(i) => {
                tokens.extend(tokenize_slice(source, body_end, close_end, false, false));
                tokens.extend_from_slice(&self.tokens[i + 1..]);
            }
            None => tokens.extend(tokenize_slice(source, body_end, source.len(), false, true)),
        }
        self.tokens = tokens;
        self.p = prefix;
    }

    /// `f` one block or element deeper, failing past [`MAX_DEPTH`].
    pub(crate) fn nested<T: Send>(
        &mut self,
        f: impl FnOnce(&mut Self) -> PResult<T> + Send,
    ) -> PResult<T> {
        if self.depth == MAX_DEPTH {
            return Err(ParseError::too_deep());
        }
        self.depth += 1;
        let r = grow_stack(self.depth, || f(self));
        self.depth -= 1;
        r
    }

    // --- node-dispatch.ts

    pub(crate) fn parse_node(&mut self) -> PResult<Node<'a>> {
        // A comment split by a block boundary resumes after the boundary tag.
        if self.parse_html && self.open_html_comment.is_some() && !self.is_block_terminator() {
            return Ok(Node::HtmlComment(self.parse_html_comment()?));
        }
        let t = self.peek();
        match t.kind {
            TT::YamlFrontmatter => {
                self.p += 1;
                let raw = &self.source[t.start..t.end];
                let body = match (raw.find('\n'), raw.rfind("---")) {
                    (Some(nl), Some(dashes)) if dashes > nl => &raw[nl + 1..dashes],
                    _ => "",
                };
                Ok(Node::YAMLFrontmatter(YamlFrontmatter {
                    body: Cow::Borrowed(body),
                    span: Span::new(t.start, t.end),
                }))
            }
            TT::EndOfInput => Err(error(
                "Unexpected end of input in parseNode".into(),
                t.start,
                t.end,
            )),
            TT::LiquidVariableOutputOpen => Ok(Node::LiquidVariableOutput(
                self.parse_liquid_variable_output()?,
            )),
            TT::LiquidTagOpen => self.parse_liquid_tag(),
            TT::HtmlTagOpen if self.parse_html => self.parse_html_element(),
            TT::HtmlCloseTagOpen if self.parse_html && self.allow_unclosed_html => Ok(
                Node::HtmlDanglingMarkerClose(self.parse_html_dangling_marker_close()?),
            ),
            TT::HtmlCloseTagOpen if self.parse_html => Err(self.parse_orphaned_html_close_tag()),
            TT::HtmlCommentOpen if self.parse_html => {
                Ok(Node::HtmlComment(self.parse_html_comment()?))
            }
            TT::HtmlDoctypeOpen if self.parse_html => {
                Ok(Node::HtmlDoctype(self.parse_html_doctype()?))
            }
            TT::HtmlCommentOpen | TT::HtmlCommentClose => {
                // A block opened inside a comment ran past the comment's `-->`.
                self.open_html_comment = (t.kind == TT::HtmlCommentOpen)
                    .then(|| self.open_html_comment.unwrap_or(Span::new(t.start, t.end)));
                self.p += 1;
                Ok(text_node(self.source, t.start, t.end))
            }
            _ => {
                self.p += 1;
                Ok(text_node(self.source, t.start, t.end))
            }
        }
    }

    // --- liquid-variable-output.ts

    pub(crate) fn parse_liquid_variable_output(&mut self) -> PResult<LiquidVariableOutput<'a>> {
        let open = self.consume(TT::LiquidVariableOutputOpen)?;
        self.accept(TT::Text);
        let close = self.consume(TT::LiquidVariableOutputClose)?;
        let raw = &self.source[open.end..close.start];
        let mut m = MarkupParser::new(tokenize_markup(raw, open.end), self.source);
        let markup = match m.liquid_variable() {
            Ok(v) if m.is_at_end() => Markup::Node(Box::new(Node::LiquidVariable(v))),
            _ => Markup::Str(Cow::Borrowed(js_trim(raw))),
        };
        Ok(LiquidVariableOutput {
            markup,
            trim_start: open.len() > 2,
            trim_end: close.len() > 2,
            markup_span: Span::new(open.end, close.start),
            span: Span::new(open.start, close.end),
        })
    }

    // --- liquid-tags.ts

    pub(crate) fn envelope(&self, open: Token, close: Token) -> Envelope<'a> {
        let inner = &self.source[open.end..close.start];
        let leading = inner.len() - js_trim_start(inner).len();
        let tag_name = first_word(inner);
        let after = leading + tag_name.len();
        let b = inner.as_bytes();
        let mut markup_offset = after;
        while markup_offset < b.len() && matches!(b[markup_offset], b' ' | b'\t') {
            markup_offset += 1;
        }
        Envelope {
            tag_name,
            markup_string: &inner[after..],
            markup_offset: open.end + markup_offset,
            markup_end: close.start,
            trim_start: open.len() > 2,
            trim_end: close.len() > 2,
            start_tag: Span::new(open.start, close.end),
        }
    }

    pub(crate) fn parse_liquid_tag(&mut self) -> PResult<Node<'a>> {
        let open = self.consume(TT::LiquidTagOpen)?;
        self.accept(TT::Text);
        let close = self.consume(TT::LiquidTagClose)?;
        let mut env = self.envelope(open, close);

        if env.tag_name.starts_with('#') {
            let len = env.tag_name.len() - 1 + env.markup_string.len();
            env.tag_name = "#";
            env.markup_offset = env.markup_end - len;
            env.markup_string = &self.source[env.markup_offset..env.markup_end];
            return Ok(Node::LiquidTag(make_tag(
                &env,
                base_markup(&env),
                None,
                None,
                None,
            )));
        }
        if let Some(inner) = env.tag_name.strip_prefix("end") {
            if tags::tag_for_name(inner).is_some() {
                return Err(error(
                    format!("Attempting to close LiquidTag '{inner}' before it was opened without a matching '{inner}'"),
                    open.start,
                    close.end,
                ));
            }
        }
        let start = close.start - env.markup_string.len();
        Ok(match tags::tag_for_name(env.tag_name) {
            None => Node::LiquidTag(make_tag(&env, base_markup(&env), None, None, None)),
            Some(TagKind::Tag) => {
                let markup = self.parse_tag_markup(env.tag_name, env.markup_string, start);
                Node::LiquidTag(finish_tag(&env, markup, None, None))
            }
            Some(TagKind::Block) => Node::LiquidTag(self.parse_block_tag(&env, start)?),
            Some(TagKind::Raw) => Node::LiquidRawTag(self.parse_raw_tag(&env, close)?),
        })
    }

    /// `def.parse` on a fresh MarkupParser over `markup` (at `start`): the markup, or the
    /// base-case `reason` when it throws or leaves tokens unconsumed.
    pub(crate) fn parse_tag_markup(
        &mut self,
        name: &str,
        markup: &'a str,
        start: usize,
    ) -> Result<Markup<'a>, Str<'a>> {
        let mut m = MarkupParser::with_range(
            tokenize_markup(markup, start),
            self.source,
            start,
            start + markup.len(),
        );
        let result = if name == "liquid" {
            self.parse_liquid_tag_body(&mut m)
        } else {
            tags::parse_markup(name, &mut m)
        };
        match result {
            Ok(_) if !m.is_at_end() => Err(Cow::Borrowed("unexpected tokens after markup")),
            Ok(markup) => Ok(markup),
            Err(e) => Err(Cow::Owned(e.message)),
        }
    }

    // --- liquid-blocks.ts

    fn parse_block_tag(&mut self, env: &Envelope<'a>, start: usize) -> PResult<LiquidTag<'a>> {
        let markup = self.parse_tag_markup(env.tag_name, env.markup_string, start);
        let saved = self.allow_unclosed_html;
        self.allow_unclosed_html = matches!(env.tag_name, "if" | "unless" | "case");
        let body = self.nested(|p| {
            if tags::branches(env.tag_name).is_empty() {
                p.parse_block_body(env)
            } else {
                p.parse_branched_body(env)
                    .map(|(b, end)| (b.into_iter().map(Node::LiquidBranch).collect(), end))
            }
        });
        self.allow_unclosed_html = saved;
        let (children, end) = body?;
        Ok(finish_tag(env, markup, Some(children), Some(end)))
    }

    fn check_block_tag(&self, env: &Envelope<'a>, tag_name: &str) -> PResult<()> {
        if let Some(inner) = tag_name.strip_prefix("end") {
            if tags::tag_for_name(inner).is_some() {
                let bsp = env.start_tag;
                return Err(error(
                    format!(
                        "Attempting to close LiquidTag '{inner}' before LiquidTag '{}' was closed",
                        env.tag_name
                    ),
                    bsp.start,
                    bsp.end,
                ));
            }
        }
        Ok(())
    }

    /// One child step of a block body; returns false when the body loop must stop.
    fn parse_block_child(&mut self, parent: &str, children: &mut Vec<Node<'a>>) -> PResult<bool> {
        let progress = self.p;
        if self.in_attribute_context && !self.in_attribute_value_context {
            children.extend(self.parse_branch_attributes()?);
        } else {
            children.push(self.parse_node()?);
        }
        if self.p == progress {
            if !self.allow_unclosed_document_node {
                let t = self.peek();
                let name = self.peek_tag_name().unwrap_or(t.kind.as_str());
                return Err(error(
                    format!("Unexpected Liquid tag '{name}' inside LiquidTag '{parent}'"),
                    t.start,
                    t.end,
                ));
            }
            if self.check(TT::LiquidTagOpen, 0) {
                children.push(self.parse_liquid_tag()?);
                return Ok(true);
            }
            return Ok(false);
        }
        Ok(true)
    }

    fn unclosed_block(&self, env: &Envelope<'a>) -> ParseError {
        let bsp = env.start_tag;
        error(
            format!(
                "Attempting to end parsing before LiquidTag '{}' was closed",
                env.tag_name
            ),
            bsp.start,
            bsp.end,
        )
    }

    pub(crate) fn parse_block_body(
        &mut self,
        env: &Envelope<'a>,
    ) -> PResult<(Vec<Node<'a>>, BlockEnd)> {
        let parent = env.tag_name;
        let mut children = Vec::new();
        while !self.is_at_end() {
            if let Some(tag_name) = self.peek_tag_name() {
                if tag_name.strip_prefix("end") == Some(parent) {
                    let end = self.consume_end_tag()?;
                    return Ok((
                        filter_children(self.source, FilterMode::Syntactic, children),
                        end,
                    ));
                }
                self.check_block_tag(env, tag_name)?;
                if matches!(tag_name, "else" | "elsif" | "when") {
                    let bsp = env.start_tag;
                    return Err(error(
                        format!("Attempting to open LiquidBranch '{tag_name}' before LiquidTag '{parent}' was closed"),
                        bsp.start,
                        bsp.end,
                    ));
                }
            }
            if !self.parse_block_child(parent, &mut children)? {
                break;
            }
        }
        let children = filter_children(self.source, FilterMode::Syntactic, children);
        let end = self.peek().start;
        if self.allow_unclosed_document_node {
            return Ok((children, (Span::new(end, end), false, false)));
        }
        Err(self.unclosed_block(env))
    }

    fn parse_branched_body(
        &mut self,
        env: &Envelope<'a>,
    ) -> PResult<(Vec<LiquidBranch<'a>>, BlockEnd)> {
        let parent = env.tag_name;
        let allowed = tags::branches(parent);
        let mut branches = Vec::new();
        let mut current = make_branch_unnamed(env.start_tag.end);
        let mut children = Vec::new();
        let mode = if self.in_attribute_value_context {
            FilterMode::Preserve
        } else {
            FilterMode::Syntactic
        };

        while !self.is_at_end() {
            if let Some(tag_name) = self.peek_tag_name() {
                if tag_name.strip_prefix("end") == Some(parent) {
                    finalize_branch(self.source, &mut current, children, self.peek().start, mode);
                    branches.push(current);
                    let end = self.consume_end_tag()?;
                    return Ok((branches, end));
                }
                if tags::is_branch_name(tag_name) && allowed.contains(&tag_name) {
                    finalize_branch(
                        self.source,
                        &mut current,
                        std::mem::take(&mut children),
                        self.peek().start,
                        mode,
                    );
                    branches.push(current);
                    let open = self.consume(TT::LiquidTagOpen)?;
                    self.accept(TT::Text);
                    let close = self.consume(TT::LiquidTagClose)?;
                    let branch_env = self.envelope(open, close);
                    let close_width = if branch_env.trim_end { 3 } else { 2 };
                    let start =
                        branch_env.start_tag.end - close_width - branch_env.markup_string.len();
                    let markup =
                        branch_markup(self.source, tag_name, branch_env.markup_string, start);
                    current = make_branch_named(&branch_env, markup);
                    continue;
                }
                self.check_block_tag(env, tag_name)?;
            }
            if !self.parse_block_child(parent, &mut children)? {
                break;
            }
        }
        let end = self.peek().start;
        finalize_branch(self.source, &mut current, children, end, mode);
        branches.push(current);
        if self.allow_unclosed_document_node {
            return Ok((branches, (Span::new(end, end), false, false)));
        }
        Err(self.unclosed_block(env))
    }

    pub(crate) fn peek_tag_name(&mut self) -> Option<&'a str> {
        if !self.check(TT::LiquidTagOpen, 0) {
            return None;
        }
        let inner = if self.check(TT::Text, 1) {
            let t = self.tokens[self.p + 1];
            &self.source[t.start..t.end]
        } else {
            ""
        };
        Some(first_word(inner))
    }

    pub(crate) fn is_block_terminator(&mut self) -> bool {
        self.peek_tag_name().is_some_and(|n| {
            !n.is_empty() && (n.starts_with("end") || n == "elsif" || n == "else" || n == "when")
        })
    }

    fn consume_end_tag(&mut self) -> PResult<BlockEnd> {
        let open = self.consume(TT::LiquidTagOpen)?;
        self.accept(TT::Text);
        let close = self.consume(TT::LiquidTagClose)?;
        Ok((
            Span::new(open.start, close.end),
            open.len() > 2,
            close.len() > 2,
        ))
    }

    // --- liquid-raw.ts

    fn parse_raw_tag(&mut self, env: &Envelope<'a>, close: Token) -> PResult<LiquidRawTag<'a>> {
        let tag_name = env.tag_name;
        let cached = self
            .raw_body_ends
            .binary_search_by_key(&(self.p - 1), |e| e.0)
            .ok()
            .map(|i| self.raw_body_ends[i].1);
        let rule = rule_for(tag_name).expect("raw tags have body rules");
        let end_tag = cached.or_else(|| find_raw_body_end(self.source, close.end, tag_name, rule));
        let Some(end_tag) = end_tag else {
            let bsp = env.start_tag;
            return Err(error(
                format!("Attempting to end parsing before LiquidRawTag '{tag_name}' was closed"),
                bsp.start,
                bsp.end,
            ));
        };
        let (body_start, body_end) = (close.end, end_tag.tag_start);
        let body = slice(self.source, body_start, body_end);
        let nodes = match tag_name {
            "doc" => crate::liquid_doc::parse_liquid_doc(
                self.source,
                body_start,
                body_start + body.len(),
            ),
            "javascript" | "style" | "stylesheet" => self.parse_liquid_in_range(body_end)?,
            _ if body_start >= body_end => Vec::new(),
            _ => filter_children(
                self.source,
                FilterMode::Syntactic,
                vec![text_node(self.source, body_start, body_end)],
            ),
        };
        let raw = RawMarkup {
            kind: raw_markup_kind_for_tag(tag_name, body),
            value: Cow::Borrowed(body),
            nodes,
            span: Span::new(body_start, body_end),
        };
        self.seek_to_source_offset(end_tag.tag_end);
        let end = (
            Span::new(end_tag.tag_start, end_tag.tag_end),
            end_tag.ws_start,
            end_tag.ws_end,
        );
        Ok(make_raw_tag(self.source, env, raw, end))
    }

    /// `parseLiquidInRange`
    pub(crate) fn parse_liquid_in_range(&mut self, body_end: usize) -> PResult<Vec<Node<'a>>> {
        let saved = self.parse_html;
        self.parse_html = false;
        let mut nodes = Vec::new();
        let mut i = self.p;
        while self.has_token(i) && self.tokens[i].start < body_end {
            let t = self.tokens[i];
            let close_kind = match t.kind {
                TT::LiquidVariableOutputOpen => TT::LiquidVariableOutputClose,
                TT::LiquidTagOpen => TT::LiquidTagClose,
                _ => {
                    nodes.push(text_node(self.source, t.start, t.end));
                    i += 1;
                    continue;
                }
            };
            let mut j = i + 1;
            while self.has_token(j) && self.tokens[j].kind != close_kind {
                j += 1;
            }
            let closes_within_body = self.has_token(j) && self.tokens[j].end <= body_end;
            if !closes_within_body {
                nodes.push(text_node(self.source, t.start, body_end));
                while self.has_token(i) && self.tokens[i].start < body_end {
                    i += 1;
                }
                break;
            }
            self.p = i;
            nodes.push(if t.kind == TT::LiquidVariableOutputOpen {
                Node::LiquidVariableOutput(self.parse_liquid_variable_output()?)
            } else {
                self.parse_liquid_tag()?
            });
            i = self.p;
        }
        self.parse_html = saved;
        self.p = i;
        Ok(filter_children(self.source, FilterMode::Syntactic, nodes))
    }
}
