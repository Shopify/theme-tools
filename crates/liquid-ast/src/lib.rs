//! Rust mirror of `packages/liquid-html-parser/src/ast.ts`.
//!
//! Conventions:
//! - Positions are UTF-8 byte offsets into the document source (TS uses UTF-16 indices; convert
//!   at output boundaries only). `Position::MISSING` stands in for TS's `{ start: -1, end: -1 }`.
//! - Struct fields are declared in the same order as the TS object keys are created, because
//!   theme-check's visitor walks keys in insertion order (see `push_children`).
//! - TS unions (`LiquidHtmlNode`, `LiquidExpression`, `AttributeNode`, ...) are `Node`; fields
//!   whose TS type is one concrete node type hold that struct directly.
//! - TS `undefined` fields are `Option` (omitted from JSON); TS `null` fields are `Option` too and
//!   the serializer knows which ones print `null`.
//! - String fields borrow the source when they can (`Cow::Borrowed`).

use std::borrow::Cow;

pub type Str<'a> = Cow<'a, str>;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
pub struct Position {
    pub start: usize,
    pub end: usize,
}

impl Position {
    /// TS `{ start: -1, end: -1 }` (unclosed branch end).
    pub const MISSING: Position = Position {
        start: usize::MAX,
        end: usize::MAX,
    };
    pub fn new(start: usize, end: usize) -> Self {
        Position { start, end }
    }
    pub fn is_missing(&self) -> bool {
        self.start == usize::MAX
    }
}

/// TS `markup` of LiquidTag / LiquidBranch / LiquidVariableOutput: a string when the base case
/// was used, else a node, an array of nodes (`{% liquid %}` statements, `form` args, `when`
/// expressions), or `null` (`ifchanged`).
#[derive(Clone, Debug)]
pub enum Markup<'a> {
    Str(Str<'a>),
    Node(Box<Node<'a>>),
    Nodes(Vec<Node<'a>>),
    Null,
}

impl<'a> Markup<'a> {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Markup::Str(s) => Some(s),
            _ => None,
        }
    }
    pub fn node(&self) -> Option<&Node<'a>> {
        match self {
            Markup::Node(n) => Some(n),
            _ => None,
        }
    }
    pub fn nodes(&self) -> Option<&[Node<'a>]> {
        match self {
            Markup::Nodes(n) => Some(n),
            _ => None,
        }
    }
    /// TS `typeof node.markup === 'string'`
    pub fn is_str(&self) -> bool {
        matches!(self, Markup::Str(_))
    }
}

#[derive(Clone, Debug)]
pub struct Document<'a> {
    pub children: Vec<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct YamlFrontmatter<'a> {
    pub body: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidRawTag<'a> {
    pub name: Str<'a>,
    pub markup: Str<'a>,
    pub markup_position: Position,
    pub body: RawMarkup<'a>,
    pub whitespace_start: bool,
    pub whitespace_end: bool,
    pub delimiter_whitespace_start: bool,
    pub delimiter_whitespace_end: bool,
    pub block_start_position: Position,
    pub block_end_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidTag<'a> {
    pub name: Str<'a>,
    pub markup: Markup<'a>,
    pub children: Option<Vec<Node<'a>>>,
    pub whitespace_start: bool,
    pub whitespace_end: bool,
    pub delimiter_whitespace_start: Option<bool>,
    pub delimiter_whitespace_end: Option<bool>,
    pub block_start_position: Position,
    pub block_end_position: Option<Position>,
    pub markup_position: Position,
    pub position: Position,
    /// Only on base-case tags (`markup` is a string), and only when set.
    pub reason: Option<Str<'a>>,
}

#[derive(Clone, Debug)]
pub struct LiquidBranch<'a> {
    /// `None` for the first (unnamed) branch.
    pub name: Option<Str<'a>>,
    pub markup: Markup<'a>,
    pub children: Vec<Node<'a>>,
    pub whitespace_start: bool,
    pub whitespace_end: bool,
    pub markup_position: Position,
    pub block_start_position: Position,
    pub block_end_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidVariableOutput<'a> {
    /// `Markup::Str` or `Markup::Node(LiquidVariable)`.
    pub markup: Markup<'a>,
    pub whitespace_start: bool,
    pub whitespace_end: bool,
    pub markup_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlElement<'a> {
    pub name: Vec<Node<'a>>,
    pub attributes: Vec<Node<'a>>,
    pub children: Vec<Node<'a>>,
    pub block_start_position: Position,
    pub block_end_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlVoidElement<'a> {
    pub name: Str<'a>,
    pub attributes: Vec<Node<'a>>,
    pub block_start_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlSelfClosingElement<'a> {
    pub name: Vec<Node<'a>>,
    pub attributes: Vec<Node<'a>>,
    pub block_start_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlRawNode<'a> {
    pub name: Str<'a>,
    pub attributes: Vec<Node<'a>>,
    pub body: RawMarkup<'a>,
    pub block_start_position: Position,
    pub block_end_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlComment<'a> {
    pub body: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlDoctype<'a> {
    pub legacy_doctype_string: Option<Str<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct HtmlDanglingMarkerClose<'a> {
    pub name: Vec<Node<'a>>,
    pub block_start_position: Position,
    pub position: Position,
}

/// AttrSingleQuoted / AttrDoubleQuoted / AttrUnquoted (the variant says which).
#[derive(Clone, Debug)]
pub struct Attr<'a> {
    pub name: Vec<Node<'a>>,
    pub value: Vec<Node<'a>>,
    pub attribute_position: Position,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct AttrEmpty<'a> {
    pub name: Vec<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct TextNode<'a> {
    pub value: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct RawMarkup<'a> {
    /// css, html, javascript, json, markdown, typescript, text
    pub kind: &'static str,
    pub value: Str<'a>,
    pub nodes: Vec<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidVariable<'a> {
    /// ComplexLiquidExpression: BooleanExpression or a LiquidExpression.
    pub expression: Box<Node<'a>>,
    pub filters: Vec<LiquidFilter<'a>>,
    pub raw_source: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidFilter<'a> {
    pub name: Str<'a>,
    /// LiquidExpression or NamedArgument nodes.
    pub args: Vec<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct NamedArgument<'a> {
    pub name: Str<'a>,
    /// A LiquidExpression, or a BlockArrayLiteral for block/section tag args.
    pub value: Box<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct BooleanExpression<'a> {
    pub condition: Box<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidString<'a> {
    /// TS omits `single` on some lookup-segment strings; `None` there.
    pub single: Option<bool>,
    pub value: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidNumber<'a> {
    pub value: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidLiteral {
    /// nil, null, true, false, blank, empty
    pub keyword: &'static str,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidRange<'a> {
    pub start: Box<Node<'a>>,
    pub end: Box<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LookupMode {
    Bareword,
    Subscript,
}

#[derive(Clone, Debug)]
pub struct VariableLookup<'a> {
    pub name: Option<Str<'a>>,
    pub lookups: Vec<Node<'a>>,
    /// Absent in TS on some constructions; `None` there.
    pub lookup_modes: Option<Vec<LookupMode>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct Comparison<'a> {
    /// contains, ==, >, >=, <, <=, !=
    pub comparator: &'static str,
    pub left: Box<Node<'a>>,
    pub right: Box<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LogicalExpression<'a> {
    /// and, or
    pub relation: &'static str,
    pub left: Box<Node<'a>>,
    pub right: Box<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct AssignMarkup<'a> {
    pub name: Str<'a>,
    pub value: LiquidVariable<'a>,
    pub position: Position,
}

/// BlockMarkup and SectionMarkup.
#[derive(Clone, Debug)]
pub struct BlockMarkup<'a> {
    pub name: LiquidString<'a>,
    pub args: Vec<NamedArgument<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct ContentForMarkup<'a> {
    pub content_for_type: LiquidString<'a>,
    pub args: Vec<NamedArgument<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct CycleMarkup<'a> {
    pub group_name: Option<Box<Node<'a>>>,
    pub args: Vec<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct ForMarkup<'a> {
    pub variable_name: Str<'a>,
    pub collection: Box<Node<'a>>,
    pub reversed: bool,
    pub args: Vec<NamedArgument<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct PaginateMarkup<'a> {
    pub collection: Box<Node<'a>>,
    pub page_size: Box<Node<'a>>,
    pub args: Vec<NamedArgument<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct RenderMarkup<'a> {
    pub snippet: Box<Node<'a>>,
    pub variable: Option<RenderVariableExpression<'a>>,
    pub alias: Option<RenderAliasExpression<'a>>,
    pub args: Vec<NamedArgument<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct RenderVariableExpression<'a> {
    /// for, with
    pub kind: &'static str,
    pub name: Box<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct RenderAliasExpression<'a> {
    pub value: Str<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct BlockArrayLiteral<'a> {
    pub elements: Vec<Node<'a>>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidDocParamNode<'a> {
    pub param_name: TextNode<'a>,
    pub param_type: Option<TextNode<'a>>,
    pub param_description: Option<TextNode<'a>>,
    pub required: bool,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidDocDescriptionNode<'a> {
    pub content: TextNode<'a>,
    pub is_implicit: bool,
    pub is_inline: bool,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidDocExampleNode<'a> {
    pub content: TextNode<'a>,
    pub is_inline: bool,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidDocPromptNode<'a> {
    pub content: TextNode<'a>,
    pub position: Position,
}

#[derive(Clone, Debug)]
pub struct LiquidErrorNode<'a> {
    pub message: Str<'a>,
    pub found: Option<Str<'a>>,
    pub position: Position,
}

macro_rules! node_types {
    ($($variant:ident($ty:ty) = $ts:literal,)*) => {
        /// An owned AST node. Variant names are the TS `NodeTypes` (plus `BlockArrayLiteral`).
        #[derive(Clone, Debug)]
        pub enum Node<'a> { $($variant($ty),)* }

        /// A borrowed node, as handed to checks by the walker. Covers struct-typed fields
        /// (e.g. `LiquidRawTag.body`) as well as `Node`s.
        #[derive(Clone, Copy, Debug)]
        pub enum NodeRef<'a> { $($variant(&'a $ty),)* }

        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
        #[repr(u8)]
        pub enum NodeKind { $($variant,)* }

        impl NodeKind {
            pub const ALL: &'static [NodeKind] = &[$(NodeKind::$variant,)*];
            /// The TS `type` string.
            pub fn type_name(self) -> &'static str {
                match self { $(NodeKind::$variant => $ts,)* }
            }
            pub fn bit(self) -> u64 { 1u64 << (self as u8) }
        }

        impl<'a> Node<'a> {
            pub fn to_ref(&'a self) -> NodeRef<'a> {
                match self { $(Node::$variant(n) => NodeRef::$variant(n),)* }
            }
            pub fn kind(&self) -> NodeKind {
                match self { $(Node::$variant(_) => NodeKind::$variant,)* }
            }
            pub fn position(&self) -> Position {
                match self { $(Node::$variant(n) => n.position,)* }
            }
            pub fn type_name(&self) -> &'static str { self.kind().type_name() }
        }

        impl<'a> NodeRef<'a> {
            pub fn kind(&self) -> NodeKind {
                match self { $(NodeRef::$variant(_) => NodeKind::$variant,)* }
            }
            pub fn position(&self) -> Position {
                match self { $(NodeRef::$variant(n) => n.position,)* }
            }
            pub fn type_name(&self) -> &'static str { self.kind().type_name() }
            /// Identity comparison (same node in memory).
            pub fn ptr_eq(&self, other: &NodeRef<'a>) -> bool {
                self.addr() == other.addr() && self.kind() == other.kind()
            }
            pub fn addr(&self) -> usize {
                match self { $(NodeRef::$variant(n) => *n as *const $ty as usize,)* }
            }
        }
    };
}

node_types! {
    Document(Document<'a>) = "Document",
    YAMLFrontmatter(YamlFrontmatter<'a>) = "YAMLFrontmatter",
    LiquidRawTag(LiquidRawTag<'a>) = "LiquidRawTag",
    LiquidTag(LiquidTag<'a>) = "LiquidTag",
    LiquidBranch(LiquidBranch<'a>) = "LiquidBranch",
    LiquidVariableOutput(LiquidVariableOutput<'a>) = "LiquidVariableOutput",
    HtmlSelfClosingElement(HtmlSelfClosingElement<'a>) = "HtmlSelfClosingElement",
    HtmlVoidElement(HtmlVoidElement<'a>) = "HtmlVoidElement",
    HtmlDoctype(HtmlDoctype<'a>) = "HtmlDoctype",
    HtmlComment(HtmlComment<'a>) = "HtmlComment",
    HtmlElement(HtmlElement<'a>) = "HtmlElement",
    HtmlDanglingMarkerClose(HtmlDanglingMarkerClose<'a>) = "HtmlDanglingMarkerClose",
    HtmlRawNode(HtmlRawNode<'a>) = "HtmlRawNode",
    AttrSingleQuoted(Attr<'a>) = "AttrSingleQuoted",
    AttrDoubleQuoted(Attr<'a>) = "AttrDoubleQuoted",
    AttrUnquoted(Attr<'a>) = "AttrUnquoted",
    AttrEmpty(AttrEmpty<'a>) = "AttrEmpty",
    TextNode(TextNode<'a>) = "TextNode",
    LiquidVariable(LiquidVariable<'a>) = "LiquidVariable",
    LiquidFilter(LiquidFilter<'a>) = "LiquidFilter",
    NamedArgument(NamedArgument<'a>) = "NamedArgument",
    LiquidLiteral(LiquidLiteral) = "LiquidLiteral",
    BooleanExpression(BooleanExpression<'a>) = "BooleanExpression",
    String(LiquidString<'a>) = "String",
    Number(LiquidNumber<'a>) = "Number",
    Range(LiquidRange<'a>) = "Range",
    VariableLookup(VariableLookup<'a>) = "VariableLookup",
    Comparison(Comparison<'a>) = "Comparison",
    LogicalExpression(LogicalExpression<'a>) = "LogicalExpression",
    AssignMarkup(AssignMarkup<'a>) = "AssignMarkup",
    BlockMarkup(BlockMarkup<'a>) = "BlockMarkup",
    ContentForMarkup(ContentForMarkup<'a>) = "ContentForMarkup",
    CycleMarkup(CycleMarkup<'a>) = "CycleMarkup",
    ForMarkup(ForMarkup<'a>) = "ForMarkup",
    PaginateMarkup(PaginateMarkup<'a>) = "PaginateMarkup",
    RawMarkup(RawMarkup<'a>) = "RawMarkup",
    RenderMarkup(RenderMarkup<'a>) = "RenderMarkup",
    SectionMarkup(BlockMarkup<'a>) = "SectionMarkup",
    RenderVariableExpression(RenderVariableExpression<'a>) = "RenderVariableExpression",
    RenderAliasExpression(RenderAliasExpression<'a>) = "RenderAliasExpression",
    LiquidDocDescriptionNode(LiquidDocDescriptionNode<'a>) = "LiquidDocDescriptionNode",
    LiquidDocParamNode(LiquidDocParamNode<'a>) = "LiquidDocParamNode",
    LiquidDocExampleNode(LiquidDocExampleNode<'a>) = "LiquidDocExampleNode",
    LiquidDocPromptNode(LiquidDocPromptNode<'a>) = "LiquidDocPromptNode",
    LiquidErrorNode(LiquidErrorNode<'a>) = "LiquidErrorNode",
    BlockArrayLiteral(BlockArrayLiteral<'a>) = "BlockArrayLiteral",
}

/// Pushes a node list the way theme-check's `visitLiquid` does: last item first, so the first
/// item pops first.
fn push_all<'a>(stack: &mut Vec<(NodeRef<'a>, usize)>, nodes: &'a [Node<'a>], depth: usize) {
    for n in nodes.iter().rev() {
        stack.push((n.to_ref(), depth));
    }
}

fn push_markup<'a>(stack: &mut Vec<(NodeRef<'a>, usize)>, m: &'a Markup<'a>, depth: usize) {
    match m {
        Markup::Node(n) => stack.push((n.to_ref(), depth)),
        Markup::Nodes(ns) => push_all(stack, ns, depth),
        Markup::Str(_) | Markup::Null => {}
    }
}

impl<'a> NodeRef<'a> {
    /// Pushes the child nodes onto `stack` exactly as `visitLiquid` pushes them: object keys in
    /// insertion order, each array's items last-to-first.
    pub fn push_children(self, stack: &mut Vec<(NodeRef<'a>, usize)>, depth: usize) {
        use NodeRef as R;
        match self {
            R::Document(n) => push_all(stack, &n.children, depth),
            R::YAMLFrontmatter(_) => {}
            R::LiquidRawTag(n) => stack.push((R::RawMarkup(&n.body), depth)),
            R::LiquidTag(n) => {
                push_markup(stack, &n.markup, depth);
                if let Some(c) = &n.children {
                    push_all(stack, c, depth);
                }
            }
            R::LiquidBranch(n) => {
                push_markup(stack, &n.markup, depth);
                push_all(stack, &n.children, depth);
            }
            R::LiquidVariableOutput(n) => push_markup(stack, &n.markup, depth),
            R::HtmlSelfClosingElement(n) => {
                push_all(stack, &n.name, depth);
                push_all(stack, &n.attributes, depth);
            }
            R::HtmlVoidElement(n) => push_all(stack, &n.attributes, depth),
            R::HtmlDoctype(_) | R::HtmlComment(_) => {}
            R::HtmlElement(n) => {
                push_all(stack, &n.name, depth);
                push_all(stack, &n.attributes, depth);
                push_all(stack, &n.children, depth);
            }
            R::HtmlDanglingMarkerClose(n) => push_all(stack, &n.name, depth),
            R::HtmlRawNode(n) => {
                push_all(stack, &n.attributes, depth);
                stack.push((R::RawMarkup(&n.body), depth));
            }
            R::AttrSingleQuoted(n) | R::AttrDoubleQuoted(n) | R::AttrUnquoted(n) => {
                push_all(stack, &n.name, depth);
                push_all(stack, &n.value, depth);
            }
            R::AttrEmpty(n) => push_all(stack, &n.name, depth),
            R::TextNode(_) => {}
            R::LiquidVariable(n) => {
                stack.push((n.expression.to_ref(), depth));
                for f in n.filters.iter().rev() {
                    stack.push((R::LiquidFilter(f), depth));
                }
            }
            R::LiquidFilter(n) => push_all(stack, &n.args, depth),
            R::NamedArgument(n) => stack.push((n.value.to_ref(), depth)),
            R::LiquidLiteral(_) => {}
            R::BooleanExpression(n) => stack.push((n.condition.to_ref(), depth)),
            R::String(_) | R::Number(_) => {}
            R::Range(n) => {
                stack.push((n.start.to_ref(), depth));
                stack.push((n.end.to_ref(), depth));
            }
            R::VariableLookup(n) => push_all(stack, &n.lookups, depth),
            R::Comparison(n) => {
                stack.push((n.left.to_ref(), depth));
                stack.push((n.right.to_ref(), depth));
            }
            R::LogicalExpression(n) => {
                stack.push((n.left.to_ref(), depth));
                stack.push((n.right.to_ref(), depth));
            }
            R::AssignMarkup(n) => stack.push((R::LiquidVariable(&n.value), depth)),
            R::BlockMarkup(n) | R::SectionMarkup(n) => {
                stack.push((R::String(&n.name), depth));
                for a in n.args.iter().rev() {
                    stack.push((R::NamedArgument(a), depth));
                }
            }
            R::ContentForMarkup(n) => {
                stack.push((R::String(&n.content_for_type), depth));
                for a in n.args.iter().rev() {
                    stack.push((R::NamedArgument(a), depth));
                }
            }
            R::CycleMarkup(n) => {
                if let Some(g) = &n.group_name {
                    stack.push((g.to_ref(), depth));
                }
                push_all(stack, &n.args, depth);
            }
            R::ForMarkup(n) => {
                stack.push((n.collection.to_ref(), depth));
                for a in n.args.iter().rev() {
                    stack.push((R::NamedArgument(a), depth));
                }
            }
            R::PaginateMarkup(n) => {
                stack.push((n.collection.to_ref(), depth));
                stack.push((n.page_size.to_ref(), depth));
                for a in n.args.iter().rev() {
                    stack.push((R::NamedArgument(a), depth));
                }
            }
            R::RawMarkup(n) => push_all(stack, &n.nodes, depth),
            R::RenderMarkup(n) => {
                stack.push((n.snippet.to_ref(), depth));
                if let Some(v) = &n.variable {
                    stack.push((R::RenderVariableExpression(v), depth));
                }
                if let Some(a) = &n.alias {
                    stack.push((R::RenderAliasExpression(a), depth));
                }
                for a in n.args.iter().rev() {
                    stack.push((R::NamedArgument(a), depth));
                }
            }
            R::RenderVariableExpression(n) => stack.push((n.name.to_ref(), depth)),
            R::RenderAliasExpression(_) => {}
            R::LiquidDocDescriptionNode(n) => stack.push((R::TextNode(&n.content), depth)),
            R::LiquidDocParamNode(n) => {
                stack.push((R::TextNode(&n.param_name), depth));
                if let Some(t) = &n.param_type {
                    stack.push((R::TextNode(t), depth));
                }
                if let Some(d) = &n.param_description {
                    stack.push((R::TextNode(d), depth));
                }
            }
            R::LiquidDocExampleNode(n) => stack.push((R::TextNode(&n.content), depth)),
            R::LiquidDocPromptNode(n) => stack.push((R::TextNode(&n.content), depth)),
            R::LiquidErrorNode(_) => {}
            R::BlockArrayLiteral(n) => push_all(stack, &n.elements, depth),
        }
    }

    /// Child nodes in the order `visit_liquid` visits them.
    pub fn children_visit_order(self) -> Vec<NodeRef<'a>> {
        let mut v = Vec::new();
        self.push_children(&mut v, 0);
        v.reverse();
        v.into_iter().map(|(n, _)| n).collect()
    }
}

/// theme-check's `visitLiquid`: preorder over an explicit stack. `visit(node, ancestors, exit)` is
/// called with `exit = false` when a node pops, then with `exit = true` right after its children
/// are queued (before they are visited), exactly like the TS walker.
pub fn visit_liquid<'a>(
    root: NodeRef<'a>,
    mut visit: impl FnMut(NodeRef<'a>, &[NodeRef<'a>], bool),
) {
    let mut stack: Vec<(NodeRef<'a>, usize)> = vec![(root, 0)];
    let mut path: Vec<NodeRef<'a>> = Vec::new();
    while let Some((node, depth)) = stack.pop() {
        path.truncate(depth);
        visit(node, &path, false);
        node.push_children(&mut stack, depth + 1);
        visit(node, &path, true);
        path.push(node);
    }
}
