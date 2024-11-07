/**
 * This is the second stage of the parser.
 *
 * Input:
 *  - A Concrete Syntax Tree (CST)
 *
 * Output:
 *  - An Abstract Syntax Tree (AST)
 *
 * This stage traverses the flat tree we get from the previous stage and
 * establishes the parent/child relationship between the nodes.
 *
 * Recall the Liquid example we had in the first stage:
 *   {% if cond %}hi <em>there!</em>{% endif %}
 *
 * Whereas the previous stage gives us this CST:
 *   - LiquidTagOpen/if
 *     condition: LiquidVariableExpression/cond
 *   - TextNode/"hi "
 *   - HtmlTagOpen/em
 *   - TextNode/"there!"
 *   - HtmlTagClose/em
 *   - LiquidTagClose/if
 *
 * We now traverse all the nodes and turn that into a proper AST:
 *   - LiquidTag/if
 *     condition: LiquidVariableExpression
 *     children:
 *       - TextNode/"hi "
 *       - HtmlElement/em
 *         children:
 *           - TextNode/"there!"
 *
 */

import {
  ConcreteAttributeNode,
  ConcreteHtmlTagClose,
  ConcreteHtmlTagOpen,
  ConcreteHtmlVoidElement,
  ConcreteLiquidVariableOutput,
  ConcreteLiquidNode,
  ConcreteLiquidTagClose,
  ConcreteNodeTypes,
  ConcreteTextNode,
  LiquidCST,
  LiquidHtmlCST,
  toLiquidHtmlCST,
  ConcreteHtmlSelfClosingElement,
  ConcreteAttrSingleQuoted,
  ConcreteAttrDoubleQuoted,
  ConcreteAttrUnquoted,
  ConcreteLiquidVariable,
  ConcreteLiquidLiteral,
  ConcreteLiquidFilter,
  ConcreteLiquidExpression,
  ConcreteLiquidNamedArgument,
  ConcreteLiquidTagNamed,
  ConcreteLiquidTag,
  ConcreteLiquidTagAssignMarkup,
  ConcreteLiquidTagRenderMarkup,
  ConcreteRenderVariableExpression,
  ConcreteLiquidTagOpenNamed,
  ConcreteLiquidTagOpen,
  ConcreteLiquidArgument,
  ConcretePaginateMarkup,
  ConcreteLiquidCondition,
  ConcreteLiquidComparison,
  ConcreteLiquidTagForMarkup,
  ConcreteLiquidTagCycleMarkup,
  ConcreteHtmlRawTag,
  ConcreteLiquidRawTag,
  LiquidHtmlConcreteNode,
  ConcreteLiquidTagBaseCase,
  ConcreteLiquidTagContentForMarkup,
} from './stage-1-cst';
import { Comparators, NamedTags, NodeTypes, nonTraversableProperties, Position } from './types';
import { assertNever, deepGet, dropLast } from './utils';
import { LiquidHTMLASTParsingError, UnclosedNode } from './errors';
import { TAGS_WITHOUT_MARKUP } from './grammar';
import { toLiquidCST } from './stage-1-cst';

interface HasPosition {
  locStart: number;
  locEnd: number;
}

/** The union type of all possible node types inside a LiquidHTML AST. */
export type LiquidHtmlNode =
  | DocumentNode
  | YAMLFrontmatter
  | LiquidNode
  | HtmlDoctype
  | HtmlNode
  | AttributeNode
  | LiquidVariable
  | LiquidExpression
  | LiquidFilter
  | LiquidNamedArgument
  | AssignMarkup
  | ContentForMarkup
  | CycleMarkup
  | ForMarkup
  | RenderMarkup
  | PaginateMarkup
  | RawMarkup
  | RenderVariableExpression
  | LiquidLogicalExpression
  | LiquidComparison
  | TextNode;

/** The root node of all LiquidHTML ASTs. */
export interface DocumentNode extends ASTNode<NodeTypes.Document> {
  children: LiquidHtmlNode[];
  name: '#document';
  // only used internally where source could be different from _source...
  // used for the fixed partial ASTs shenanigans...
  _source: string;
}

export interface YAMLFrontmatter extends ASTNode<NodeTypes.YAMLFrontmatter> {
  body: string;
}

/** The union type of every node that are considered Liquid. {% ... %}, {{ ... }} */
export type LiquidNode = LiquidRawTag | LiquidTag | LiquidVariableOutput | LiquidBranch;

/** The union type of every node that could should up in a {% liquid %} tag */
export type LiquidStatement = LiquidRawTag | LiquidTag | LiquidBranch;

export interface HasChildren {
  children?: LiquidHtmlNode[];
}
export interface HasAttributes {
  attributes: AttributeNode[];
}
export interface HasValue {
  value: (TextNode | LiquidNode)[];
}
export interface HasName {
  name: string | LiquidVariableOutput;
}
export interface HasCompoundName {
  name: (TextNode | LiquidNode)[];
}

export type ParentNode = Extract<
  LiquidHtmlNode,
  HasChildren | HasAttributes | HasValue | HasName | HasCompoundName
>;

/**
 * A LiquidRawTag is one that is parsed such that its body is a raw string.
 *
 * Examples:
 * - {% raw %}...{% endraw %}
 * - {% javascript %}...{% endjavascript %}
 * - {% style %}...{% endstyle %}
 */
export interface LiquidRawTag extends ASTNode<NodeTypes.LiquidRawTag> {
  /** e.g. raw, style, javascript */
  name: string;

  /** The non-name part inside the opening Liquid tag. {% tagName [markup] %} */
  markup: string;

  /** String body of the tag. We don't try to parse it. */
  body: RawMarkup;

  /** {%- tag %} */
  whitespaceStart: '-' | '';
  /** {% tag -%} */
  whitespaceEnd: '-' | '';
  /** {%- endtag %} */
  delimiterWhitespaceStart: '-' | '';
  /** {% endtag -%} */
  delimiterWhitespaceEnd: '-' | '';

  /** the range of the opening tag {% tag %} */
  blockStartPosition: Position;
  /** the range of the closing tag {% endtag %}*/
  blockEndPosition: Position;
}

/** The union type of strictly typed and loosely typed Liquid tag nodes */
export type LiquidTag = LiquidTagNamed | LiquidTagBaseCase;

/** The union type of all strictly typed LiquidTag nodes */
export type LiquidTagNamed =
  | LiquidTagAssign
  | LiquidTagCase
  | LiquidTagCapture
  | LiquidTagContentFor
  | LiquidTagCycle
  | LiquidTagDecrement
  | LiquidTagEcho
  | LiquidTagFor
  | LiquidTagForm
  | LiquidTagIf
  | LiquidTagInclude
  | LiquidTagIncrement
  | LiquidTagLayout
  | LiquidTagLiquid
  | LiquidTagPaginate
  | LiquidTagRender
  | LiquidTagSection
  | LiquidTagSections
  | LiquidTagTablerow
  | LiquidTagUnless;

export interface LiquidTagNode<Name, Markup> extends ASTNode<NodeTypes.LiquidTag> {
  /** e.g. if, ifchanged, for, etc. */
  name: Name;

  /** The non-name part inside the opening Liquid tag. {% tagName [markup] %} */
  markup: Markup;

  /** If the node has child nodes, the array of child nodes */
  children?: LiquidHtmlNode[];

  /** {%- tag %} */
  whitespaceStart: '-' | '';
  /** {% tag -%} */
  whitespaceEnd: '-' | '';
  /** {%- endtag %}, if it has one */
  delimiterWhitespaceStart?: '-' | '';
  /** {% endtag -%}, if it has one */
  delimiterWhitespaceEnd?: '-' | '';

  /** the range of the opening tag {% tag %} */
  blockStartPosition: Position;
  /** the range of the closing tag {% endtag %}, if it has one */
  blockEndPosition?: Position;
}

/**
 * LiquidTagBaseCase exists as a fallback for when we can't strictly parse a tag.
 *
 * For any of the following reasons:
 *   - there's a syntax error in the markup and we want to be resilient
 *   - the parser does not support the tag (yet) and we want to be resilient
 *
 * As such, when we parse `{% tagName [markup] %}`, LiquidTagBaseCase is the
 * case where `markup` is parsed as a string instead of anything specific.
 */
export interface LiquidTagBaseCase extends LiquidTagNode<string, string> {}

/** https://shopify.dev/docs/api/liquid/tags#echo */
export interface LiquidTagEcho extends LiquidTagNode<NamedTags.echo, LiquidVariable> {}

/** https://shopify.dev/docs/api/liquid/tags#assign */
export interface LiquidTagAssign extends LiquidTagNode<NamedTags.assign, AssignMarkup> {}

/** {% assign name = value %} */
export interface AssignMarkup extends ASTNode<NodeTypes.AssignMarkup> {
  /** the name of the variable that is being assigned */
  name: string;

  /** the value of the variable that is being assigned */
  value: LiquidVariable;
}

/** https://shopify.dev/docs/api/liquid/tags#increment */
export interface LiquidTagIncrement
  extends LiquidTagNode<NamedTags.increment, LiquidVariableLookup> {}

/** https://shopify.dev/docs/api/liquid/tags#decrement */
export interface LiquidTagDecrement
  extends LiquidTagNode<NamedTags.decrement, LiquidVariableLookup> {}

/** https://shopify.dev/docs/api/liquid/tags#capture */
export interface LiquidTagCapture extends LiquidTagNode<NamedTags.capture, LiquidVariableLookup> {}

/** https://shopify.dev/docs/api/liquid/tags#cycle */
export interface LiquidTagCycle extends LiquidTagNode<NamedTags.cycle, CycleMarkup> {}

/** {% cycle [groupName:] arg1, arg2, arg3 %} */
export interface CycleMarkup extends ASTNode<NodeTypes.CycleMarkup> {
  /** {% cycle groupName: arg1, arg2, arg3 %} */
  groupName: LiquidExpression | null;
  /** {% cycle arg1, arg2, arg3, ... %} */
  args: LiquidExpression[];
}

/** https://shopify.dev/docs/api/liquid/tags#case */
export interface LiquidTagCase extends LiquidTagNode<NamedTags.case, LiquidExpression> {}

/**
 * {% when expression1, expression2 or expression3 %}
 *   children
 */
export interface LiquidBranchWhen extends LiquidBranchNode<NamedTags.when, LiquidExpression[]> {}

/** https://shopify.dev/docs/api/liquid/tags#form */
export interface LiquidTagForm extends LiquidTagNode<NamedTags.form, LiquidArgument[]> {}

/** https://shopify.dev/docs/api/liquid/tags#for */
export interface LiquidTagFor extends LiquidTagNode<NamedTags.for, ForMarkup> {}

/** {% for variableName in collection [reversed] [...namedArguments] %} */
export interface ForMarkup extends ASTNode<NodeTypes.ForMarkup> {
  /** {% for variableName in collection %} */
  variableName: string;

  /** {% for variableName in collection %} */
  collection: LiquidExpression;

  /** Whether the for loop is reversed */
  reversed: boolean;

  /** Holds arguments such as limit: 10, offset: 3 */
  args: LiquidNamedArgument[];
}

/** https://shopify.dev/docs/api/liquid/tags#tablerow */
export interface LiquidTagTablerow extends LiquidTagNode<NamedTags.tablerow, ForMarkup> {}

/** https://shopify.dev/docs/api/liquid/tags#if */
export interface LiquidTagIf extends LiquidTagConditional<NamedTags.if> {}

/** https://shopify.dev/docs/api/liquid/tags#unless */
export interface LiquidTagUnless extends LiquidTagConditional<NamedTags.unless> {}

/** {% elsif cond %} */
export interface LiquidBranchElsif
  extends LiquidBranchNode<NamedTags.elsif, LiquidConditionalExpression> {}

// Helper for creating the types of if and unless
export interface LiquidTagConditional<Name>
  extends LiquidTagNode<Name, LiquidConditionalExpression> {}

/** The union type of all conditional expression nodes */
export type LiquidConditionalExpression =
  | LiquidLogicalExpression
  | LiquidComparison
  | LiquidExpression;

/** Represents `left (and|or) right` conditional expressions */
export interface LiquidLogicalExpression extends ASTNode<NodeTypes.LogicalExpression> {
  relation: 'and' | 'or';
  left: LiquidConditionalExpression;
  right: LiquidConditionalExpression;
}

/** Represents `left (<|<=|=|>=|>|contains) right` conditional expressions */
export interface LiquidComparison extends ASTNode<NodeTypes.Comparison> {
  comparator: Comparators;
  left: LiquidConditionalExpression;
  right: LiquidConditionalExpression;
}

/** https://shopify.dev/docs/api/liquid/tags#paginate */
export interface LiquidTagPaginate extends LiquidTagNode<NamedTags.paginate, PaginateMarkup> {}

/** {% paginate collection by pageSize [...namedArgs] %} */
export interface PaginateMarkup extends ASTNode<NodeTypes.PaginateMarkup> {
  /** {% paginate collection by pageSize %} */
  collection: LiquidExpression;
  /** {% paginate collection by pageSize %} */
  pageSize: LiquidExpression;
  /** optional named arguments such as `window_size: 10` */
  args: LiquidNamedArgument[];
}

/** https://shopify.dev/docs/api/liquid/tags#content_for */
export interface LiquidTagContentFor
  extends LiquidTagNode<NamedTags.content_for, ContentForMarkup> {}

/** https://shopify.dev/docs/api/liquid/tags#render */
export interface LiquidTagRender extends LiquidTagNode<NamedTags.render, RenderMarkup> {}

/** https://shopify.dev/docs/api/liquid/tags#include */
export interface LiquidTagInclude extends LiquidTagNode<NamedTags.include, RenderMarkup> {}

/** https://shopify.dev/docs/api/liquid/tags#section */
export interface LiquidTagSection extends LiquidTagNode<NamedTags.section, LiquidString> {}

/** https://shopify.dev/docs/api/liquid/tags#sections */
export interface LiquidTagSections extends LiquidTagNode<NamedTags.sections, LiquidString> {}

/** https://shopify.dev/docs/api/liquid/tags#layout */
export interface LiquidTagLayout extends LiquidTagNode<NamedTags.layout, LiquidExpression> {}

/** https://shopify.dev/docs/api/liquid/tags#liquid */
export interface LiquidTagLiquid extends LiquidTagNode<NamedTags.liquid, LiquidStatement[]> {}

/** {% content_for 'contentForType' [...namedArguments] %} */
export interface ContentForMarkup extends ASTNode<NodeTypes.ContentForMarkup> {
  /** {% content_for 'contentForType' %} */
  contentForType: LiquidString;
  /** {% content_for 'contentForType', arg1: value1, arg2: value2 %} */
  args: LiquidNamedArgument[];
}

/** {% render 'snippet' [(with|for) variable [as alias]], [...namedArguments] %} */
export interface RenderMarkup extends ASTNode<NodeTypes.RenderMarkup> {
  /** {% render snippet %} */
  snippet: LiquidString | LiquidVariableLookup;
  /** {% render 'snippet' with thing as alias %} */
  alias: string | null;
  /** {% render 'snippet' [with variable] %} */
  variable: RenderVariableExpression | null;
  /** {% render 'snippet', arg1: value1, arg2: value2 %} */
  args: LiquidNamedArgument[];
}

/** Represents the `for name` or `with name` expressions in render nodes */
export interface RenderVariableExpression extends ASTNode<NodeTypes.RenderVariableExpression> {
  /** {% render 'snippet' (for|with) name %} */
  kind: 'for' | 'with';
  /** {% render 'snippet' (for|with) name %} */
  name: LiquidExpression;
}

/** The union type of the strictly and loosely typed LiquidBranch nodes */
export type LiquidBranch = LiquidBranchUnnamed | LiquidBranchBaseCase | LiquidBranchNamed;

/** The union type of the strictly typed LiquidBranch nodes */
export type LiquidBranchNamed = LiquidBranchElsif | LiquidBranchWhen;

interface LiquidBranchNode<Name, Markup> extends ASTNode<NodeTypes.LiquidBranch> {
  /**
   * The liquid tag name of the branch, null when the first branch.
   *
   * {% if condA %}
   *   defaultBranchContents
   * {% elseif condB %}
   *   elsifBranchContents
   * {% endif %}
   *
   * This creates the following AST:
   *   type: LiquidTag
   *   name: if
   *   markup: condA
   *   children:
   *     - type: LiquidBranch
   *       name: null
   *       markup: ''
   *       children:
   *         - defaultBranchContents
   *     - type: LiquidBranch
   *       name: elsif
   *       markup: condB
   *       children:
   *         - elsifBranchContents
   */
  name: Name;

  /** {% name [markup] %} */
  markup: Markup;
  /** The child nodes of the branch */
  children: LiquidHtmlNode[];
  /** {%- elsif %} */
  whitespaceStart: '-' | '';
  /** {% elsif -%} */
  whitespaceEnd: '-' | '';
  /** Range of the LiquidTag that delimits the branch (does not include children) */
  blockStartPosition: Position;
  /** 0-size range that delimits where the branch ends, (-1, -1) when unclosed */
  blockEndPosition: Position;
}

/**
 * The first branch inside branched statements (e.g. if, when, for)
 *
 * This one is different in the sense that it doesn't have a name or markup
 * since that information is held by the parent node.
 */
export interface LiquidBranchUnnamed extends LiquidBranchNode<null, string> {}

/** Loosely typed LiquidBranch nodes. Markup is a string because we can't strictly parse it. */
export interface LiquidBranchBaseCase extends LiquidBranchNode<string, string> {}

/** Represents {{ expression (| filters)* }}. Its position includes the braces. */
export interface LiquidVariableOutput extends ASTNode<NodeTypes.LiquidVariableOutput> {
  /** The body of the variable output. May contain filters. Not trimmed. */
  markup: string | LiquidVariable;
  /** {{- variable }} */
  whitespaceStart: '-' | '';
  /** {{ variable -}} */
  whitespaceEnd: '-' | '';
}

/** Represents an expression and filters, e.g. expression | filter1 | filter2 */
export interface LiquidVariable extends ASTNode<NodeTypes.LiquidVariable> {
  /** expression | filter1 | filter2 */
  expression: LiquidExpression;

  /** expression | filter1 | filter2 */
  filters: LiquidFilter[];

  /** Used internally */
  rawSource: string;
}

/** The union type of all Liquid expression nodes */
export type LiquidExpression =
  | LiquidString
  | LiquidNumber
  | LiquidLiteral
  | LiquidRange
  | LiquidVariableLookup;

/** https://shopify.dev/docs/api/liquid/filters */
export interface LiquidFilter extends ASTNode<NodeTypes.LiquidFilter> {
  /** name: arg1, arg2, namedArg3: value3 */
  name: string;
  /** name: arg1, arg2, namedArg3: value3 */
  args: LiquidArgument[];
}

/** Represents the union type of positional and named arguments */
export type LiquidArgument = LiquidExpression | LiquidNamedArgument;

/** Named arguments are the ones used in kwargs, such as `name: value` */
export interface LiquidNamedArgument extends ASTNode<NodeTypes.NamedArgument> {
  /** name: value */
  name: string;

  /** name: value */
  value: LiquidExpression;
}

/** https://shopify.dev/docs/api/liquid/basics#string */
export interface LiquidString extends ASTNode<NodeTypes.String> {
  /** single or double quote? */
  single: boolean;

  /** The contents of the string, parsed, does not included the delimiting quote characters */
  value: string;
}

/** https://shopify.dev/docs/api/liquid/basics#number */
export interface LiquidNumber extends ASTNode<NodeTypes.Number> {
  /** as a string for compatibility with numbers like 100_000 */
  value: string;
}

/** https://shopify.dev/docs/api/liquid/tags/for#for-range */
export interface LiquidRange extends ASTNode<NodeTypes.Range> {
  start: LiquidExpression;
  end: LiquidExpression;
}

/** empty, null, true, false, etc. */
export interface LiquidLiteral extends ASTNode<NodeTypes.LiquidLiteral> {
  /** string representation of the literal (e.g. nil) */
  keyword: ConcreteLiquidLiteral['keyword'];
  /** value representation of the literal (e.g. null) */
  value: ConcreteLiquidLiteral['value'];
}

/**
 * What we think of when we think of variables.
 * variable.lookup1[lookup2].lookup3
 */
export interface LiquidVariableLookup extends ASTNode<NodeTypes.VariableLookup> {
  /**
   * The root name of the lookup, `null` for the global access exception:
   *   {{ product }}     -> name = 'product', lookups = []
   *   {{ ['product'] }} -> name = null,      lookups = ['product']
   */
  name: string | null;

  /** name.lookup1[lookup2] */
  lookups: LiquidExpression[];
}

/** The union type of all HTML nodes */
export type HtmlNode =
  | HtmlComment
  | HtmlElement
  | HtmlDanglingMarkerClose
  | HtmlVoidElement
  | HtmlSelfClosingElement
  | HtmlRawNode;

/** The basic HTML node with an opening and closing tags. */
export interface HtmlElement extends HtmlNodeBase<NodeTypes.HtmlElement> {
  /**
   * The name of the tag can be compound
   * e.g. `<{{ header_type }}--header />`
   */
  name: (TextNode | LiquidVariableOutput)[];

  /** The child nodes delimited by the start and end tags */
  children: LiquidHtmlNode[];

  /** The range covered by the end tag */
  blockEndPosition: Position;
}

/**
 * The node used to represent close tags without its matching opening tag.
 *
 * Typically found inside if statements.

 * ```
 * {% if cond %}
 *   </wrapper>
 * {% endif %}
 * ```
 */
export interface HtmlDanglingMarkerClose extends ASTNode<NodeTypes.HtmlDanglingMarkerClose> {
  /**
   * The name of the tag can be compound
   * e.g. `<{{ header_type }}--header />`
   */
  name: (TextNode | LiquidVariableOutput)[];

  /** The range covered by the dangling end tag */
  blockStartPosition: Position;
}

export interface HtmlSelfClosingElement extends HtmlNodeBase<NodeTypes.HtmlSelfClosingElement> {
  /**
   * The name of the tag can be compound
   * @example `<{{ header_type }}--header />`
   */
  name: (TextNode | LiquidVariableOutput)[];
}

/**
 * Represents HTML Void elements. The ones that cannot have child nodes.
 *
 * https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
export interface HtmlVoidElement extends HtmlNodeBase<NodeTypes.HtmlVoidElement> {
  /** This one can't have a compound name since they come from a list */
  name: string;
}

/**
 * Special case of HTML Element for which we don't want to try to parse the
 * children. The children is parsed as a raw string.
 *
 * e.g. `script`, `style`
 */
export interface HtmlRawNode extends HtmlNodeBase<NodeTypes.HtmlRawNode> {
  /** The innerHTML of the tag as a string. Not trimmed. Not parsed. */
  body: RawMarkup;

  /** script, style, etc. */
  name: string;

  /** The range covered by the end tag */
  blockEndPosition: Position;
}

/**
 * The infered kind of raw markup
 * - `<script>` is javascript
 * - `<script type="application/json">` is JSON
 * - `<style>` is css
 * - etc.
 */
export enum RawMarkupKinds {
  css = 'css',
  html = 'html',
  javascript = 'javascript',
  json = 'json',
  markdown = 'markdown',
  typescript = 'typescript',
  text = 'text',
}

/** Represents parsed-as-string content. */
export interface RawMarkup extends ASTNode<NodeTypes.RawMarkup> {
  /** javascript, css, markdown, text, etc. */
  kind: RawMarkupKinds;
  /** string value of the contents */
  value: string;
  /** parsed contents for when you want to visit the tree anyway! */
  nodes: (LiquidNode | TextNode)[];
}

/** Used to represent the `<!doctype html>` nodes */
export interface HtmlDoctype extends ASTNode<NodeTypes.HtmlDoctype> {
  legacyDoctypeString: string | null;
}

/** Represents `<!-- comments -->` */
export interface HtmlComment extends ASTNode<NodeTypes.HtmlComment> {
  body: string;
}

export interface HtmlNodeBase<T> extends ASTNode<T> {
  /** the HTML and Liquid attributes of the HTML tag */
  attributes: AttributeNode[];
  /** the range covered by the start tag */
  blockStartPosition: Position;
}

/**
 * The union type of HTML attributes and Liquid nodes
 *
 * ```
 * <link
 *   {% if attr1 %}
 *     attr1
 *   {% endif %}
 *   attr2=unquoted
 *   attr3='singleQuoted'
 *   attr4="doubleQuoted + {{ product }}"
 *   {{ block_attributes }}
 * >
 * ```
 */
export type AttributeNode =
  | LiquidNode
  | AttrSingleQuoted
  | AttrDoubleQuoted
  | AttrUnquoted
  | AttrEmpty;

/** `<tag attr='single quoted'>` */
export interface AttrSingleQuoted extends AttributeNodeBase<NodeTypes.AttrSingleQuoted> {}

/** `<tag attr="double quoted">` */
export interface AttrDoubleQuoted extends AttributeNodeBase<NodeTypes.AttrDoubleQuoted> {}

/** `<tag attr=unquoted>` */
export interface AttrUnquoted extends AttributeNodeBase<NodeTypes.AttrUnquoted> {}

/** `<tag empty>` */
export interface AttrEmpty extends ASTNode<NodeTypes.AttrEmpty> {
  name: (TextNode | LiquidVariableOutput)[];
}

/** Attribute values are represented by the concatenation of Text and Liquid nodes */
export type ValueNode = TextNode | LiquidNode;

export interface AttributeNodeBase<T> extends ASTNode<T> {
  /**
   * HTML attribute names are represented by the concatenation of Text and Liquid nodes.
   *
   * `<tag compound--{{ name }}="value">`
   */
  name: (TextNode | LiquidVariableOutput)[];

  /**
   * HTML attribute values are represented by the concatenation of Text and Liquid nodes.
   *
   * `<tag attr="text and {{ product }} and text">`
   */
  value: ValueNode[];

  /** The range covered by the attribute value (excluding quotes) */
  attributePosition: Position;
}

/** Represent generic text */
export interface TextNode extends ASTNode<NodeTypes.TextNode> {
  value: string;
}

export interface ASTNode<T> {
  /**
   * The type of the node, as a string.
   * This property is used in discriminated unions.
   */
  type: T;
  /** The range that the node covers */
  position: Position;

  /**
   * The contents of the entire document.
   *
   * To obtain the source of the node, use the following:
   *
   * `node.source.slice(node.position.start, node.position.end)`
   */
  source: string;
}

interface ASTBuildOptions {
  /** Whether the parser should throw if the document node isn't closed */
  allowUnclosedDocumentNode: boolean;

  /**
   * 'strict' will disable the Liquid parsing base cases. Which means that we will
   * throw an error if we can't parse the node `markup` properly.
   *
   * 'tolerant' is the default case so that prettier can pretty print nodes
   * that it doesn't understand.
   */
  mode: 'strict' | 'tolerant' | 'completion';
}

export function isBranchedTag(node: LiquidHtmlNode) {
  return node.type === NodeTypes.LiquidTag && ['if', 'for', 'unless', 'case'].includes(node.name);
}

function isConcreteLiquidBranchDisguisedAsTag(
  node: LiquidHtmlConcreteNode,
): node is ConcreteLiquidTag & { name: 'else' | 'elsif' | 'when' } {
  return node.type === ConcreteNodeTypes.LiquidTag && ['else', 'elsif', 'when'].includes(node.name);
}

export function toLiquidAST(
  source: string,
  options: ASTBuildOptions = {
    allowUnclosedDocumentNode: true,
    mode: 'tolerant',
  },
) {
  const cst = toLiquidCST(source, { mode: options.mode });
  const root: DocumentNode = {
    type: NodeTypes.Document,
    source: source,
    _source: source, // this can get replaced somewhere else...
    children: cstToAst(cst, options),
    name: '#document',
    position: {
      start: 0,
      end: source.length,
    },
  };
  return root;
}

export function toLiquidHtmlAST(
  source: string,
  options: ASTBuildOptions = {
    allowUnclosedDocumentNode: false,
    mode: 'tolerant',
  },
): DocumentNode {
  const cst = toLiquidHtmlCST(source, { mode: options.mode });
  const root: DocumentNode = {
    type: NodeTypes.Document,
    source: source,
    _source: source,
    children: cstToAst(cst, options),
    name: '#document',
    position: {
      start: 0,
      end: source.length,
    },
  };
  return root;
}

type ConcreteCloseNode = ConcreteLiquidTagClose | ConcreteHtmlTagClose;

class ASTBuilder {
  /** the AST is what we're building incrementally */
  ast: LiquidHtmlNode[];

  /**
   * The cursor represents the path to the array we would push nodes to.
   *
   * It evolves like this:
   * - [0, 'children']
   * - [0, 'children', 0, 'children']
   * - [1, 'children']
   * - [1, 'children', 0, 'children']
   * - [1, 'children', 2, 'children']
   * - ...
   *
   * This way, deepGet(cursor, ast) == array of nodes to push to.
   *
   * this.current.push(node);
   */
  cursor: (string | number)[];

  /** The source is the original string */
  source: string;

  constructor(source: string) {
    this.ast = [];
    this.cursor = [];
    this.source = source;
  }

  // Returns the array to push nodes to.
  get current() {
    return deepGet<LiquidHtmlNode[]>(this.cursor, this.ast) as LiquidHtmlNode[];
  }

  // Returns the position of the current node in the array
  get currentPosition(): number {
    return (this.current || []).length - 1;
  }

  get parent(): ParentNode | undefined {
    if (this.cursor.length == 0) return undefined;
    return deepGet<ParentNode>(dropLast(1, this.cursor), this.ast);
  }

  get grandparent(): ParentNode | undefined {
    if (this.cursor.length < 4) return undefined;
    return deepGet<ParentNode>(dropLast(3, this.cursor), this.ast);
  }

  open(node: LiquidHtmlNode) {
    this.current.push(node);
    this.cursor.push(this.currentPosition);
    this.cursor.push('children');

    if (isBranchedTag(node)) {
      this.open(toUnnamedLiquidBranch(node));
    }
  }

  push(node: LiquidHtmlNode) {
    if (node.type === NodeTypes.LiquidBranch) {
      const previousBranch = this.findCloseableParentBranch(node);
      if (previousBranch) {
        previousBranch.blockEndPosition = { start: node.position.start, end: node.position.start };
        // close dangling open HTML nodes
        while (
          this.parent &&
          (this.parent as ParentNode) !== previousBranch &&
          this.parent.type === NodeTypes.HtmlElement
        ) {
          // 0-length blockEndPosition at the position of the next branch
          this.parent.blockEndPosition = { start: node.position.start, end: node.position.start };
          this.closeParentWith(node);
        }
        // close the previous branch
        this.closeParentWith(node);
      }
      this.open(node);
    } else {
      this.current.push(node);
    }
  }

  close(node: ConcreteCloseNode, nodeType: NodeTypes.LiquidTag | NodeTypes.HtmlElement) {
    if (isLiquidBranch(this.parent)) {
      this.parent.blockEndPosition = { start: node.locStart, end: node.locStart };
      this.closeParentWith(node);
    }

    if (!this.parent) {
      throw new LiquidHTMLASTParsingError(
        `Attempting to close ${nodeType} '${getName(node)}' before it was opened`,
        this.source,
        node.locStart,
        node.locEnd,
      );
    }

    if (getName(this.parent) !== getName(node) || this.parent.type !== nodeType) {
      const suitableParent = this.findCloseableParentNode(node);

      if (this.parent.type === NodeTypes.HtmlElement && suitableParent) {
        // close dangling open HTML nodes
        while ((this.parent as ParentNode) !== suitableParent) {
          // 0-length end block position
          this.parent.blockEndPosition = { start: node.locStart, end: node.locStart };
          this.closeParentWith(node);
        }
      } else {
        throw new LiquidHTMLASTParsingError(
          `Attempting to close ${nodeType} '${getName(node)}' before ${this.parent.type} '${getName(
            this.parent,
          )}' was closed`,
          this.source,
          this.parent.position.start,
          node.locEnd,
          getUnclosed(this.parent),
        );
      }
    }

    // The parent end is the end of the outer tag.
    this.parent.position.end = node.locEnd;
    this.parent.blockEndPosition = position(node);
    if (this.parent.type == NodeTypes.LiquidTag && node.type == ConcreteNodeTypes.LiquidTagClose) {
      this.parent.delimiterWhitespaceStart = node.whitespaceStart ?? '';
      this.parent.delimiterWhitespaceEnd = node.whitespaceEnd ?? '';
    }
    this.cursor.pop();
    this.cursor.pop();
  }

  // This function performs the following tasks:
  // - Tries to find a parent branch to close when pushing a new branch.
  // - This is necessary because we allow unclosed HTML element nodes.
  // - The function traverses up the tree until it finds a LiquidBranch.
  // - If it encounters anything other than an Unclosed HTML Element, it throws.
  findCloseableParentBranch(next: LiquidBranch): LiquidBranch | null {
    for (let index = this.cursor.length - 1; index > 0; index -= 2) {
      const parent = deepGet<ParentNode>(this.cursor.slice(0, index), this.ast);
      const parentProperty = this.cursor[index] as string;
      const isUnclosedHtmlElement =
        parent.type === NodeTypes.HtmlElement && parentProperty === 'children';
      if (parent.type === NodeTypes.LiquidBranch) {
        return parent;
      } else if (!isUnclosedHtmlElement) {
        throw new LiquidHTMLASTParsingError(
          `Attempting to open LiquidBranch '${next.name}' before ${parent.type} '${getName(
            parent,
          )}' was closed`,
          this.source,
          parent.position.start,
          next.position.end,
        );
      }
    }
    return null;
  }

  // Check if there's a parent in the ancestry that this node correctly closes
  findCloseableParentNode(
    current: ConcreteHtmlTagClose | ConcreteLiquidTagClose,
  ): LiquidTag | null {
    for (let index = this.cursor.length - 1; index > 0; index -= 2) {
      const parent = deepGet<ParentNode>(this.cursor.slice(0, index), this.ast);
      if (
        getName(parent) === getName(current) &&
        parent.type === NodeTypes.LiquidTag &&
        ['if', 'unless', 'case'].includes(parent.name)
      ) {
        return parent;
      } else if (parent.type === NodeTypes.LiquidTag) {
        return null;
      }
    }
    return null;
  }

  // sets the parent's end position to the start of the next one.
  closeParentWith(next: LiquidHtmlNode | ConcreteCloseNode) {
    if (this.parent) {
      if ('locStart' in next) {
        this.parent.position.end = next.locStart;
      } else {
        this.parent.position.end = next.position.start;
      }
    }
    this.cursor.pop();
    this.cursor.pop();
  }
}

function isLiquidBranch(node: LiquidHtmlNode | undefined): node is LiquidBranchNode<any, any> {
  return !!node && node.type === NodeTypes.LiquidBranch;
}

export function getName(
  node: ConcreteLiquidTagClose | ConcreteHtmlTagClose | ParentNode | undefined,
): string | null {
  if (!node) return null;
  switch (node.type) {
    case NodeTypes.HtmlElement:
    case NodeTypes.HtmlDanglingMarkerClose:
    case NodeTypes.HtmlSelfClosingElement:
    case ConcreteNodeTypes.HtmlTagClose:
      return node.name
        .map((part) => {
          if (part.type === NodeTypes.TextNode || part.type == ConcreteNodeTypes.TextNode) {
            return part.value;
          } else if (typeof part.markup === 'string') {
            return `{{${part.markup.trim()}}}`;
          } else {
            return `{{${part.markup.rawSource}}}`;
          }
        })
        .join('');
    case NodeTypes.AttrEmpty:
    case NodeTypes.AttrUnquoted:
    case NodeTypes.AttrDoubleQuoted:
    case NodeTypes.AttrSingleQuoted:
      // <a href="{{ hello }}">
      return node.name
        .map((part) => {
          if (typeof part === 'string') {
            return part;
          } else {
            return part.source.slice(part.position.start, part.position.end);
          }
        })
        .join('');
    default:
      return node.name;
  }
}

export function cstToAst(
  cst: LiquidHtmlCST | LiquidCST | ConcreteAttributeNode[],
  options: ASTBuildOptions,
): LiquidHtmlNode[] {
  if (cst.length === 0) return [];

  const builder = buildAst(cst, options);

  if (!options.allowUnclosedDocumentNode && builder.cursor.length !== 0) {
    throw new LiquidHTMLASTParsingError(
      `Attempting to end parsing before ${builder.parent?.type} '${getName(
        builder.parent,
      )}' was closed`,
      builder.source,
      builder.source.length - 1,
      builder.source.length,
      getUnclosed(builder.parent, builder.grandparent),
    );
  }

  return builder.ast;
}

function buildAst(
  cst: LiquidHtmlCST | LiquidCST | ConcreteAttributeNode[],
  options: ASTBuildOptions,
) {
  const builder = new ASTBuilder(cst[0].source);

  for (let i = 0; i < cst.length; i++) {
    const node = cst[i];

    switch (node.type) {
      case ConcreteNodeTypes.TextNode: {
        builder.push(toTextNode(node));
        break;
      }

      case ConcreteNodeTypes.LiquidVariableOutput: {
        builder.push(toLiquidVariableOutput(node));
        break;
      }

      case ConcreteNodeTypes.LiquidTagOpen: {
        builder.open(toLiquidTag(node, { ...options, isBlockTag: true }));
        break;
      }

      case ConcreteNodeTypes.LiquidTagClose: {
        builder.close(node, NodeTypes.LiquidTag);
        break;
      }

      case ConcreteNodeTypes.LiquidTag: {
        builder.push(toLiquidTag(node, { ...options, isBlockTag: false }));
        break;
      }

      case ConcreteNodeTypes.LiquidRawTag: {
        builder.push({
          type: NodeTypes.LiquidRawTag,
          markup: markup(node.name, node.markup),
          name: node.name,
          body: toRawMarkup(node, options),
          whitespaceStart: node.whitespaceStart ?? '',
          whitespaceEnd: node.whitespaceEnd ?? '',
          delimiterWhitespaceStart: node.delimiterWhitespaceStart ?? '',
          delimiterWhitespaceEnd: node.delimiterWhitespaceEnd ?? '',
          position: position(node),
          blockStartPosition: {
            start: node.blockStartLocStart,
            end: node.blockStartLocEnd,
          },
          blockEndPosition: {
            start: node.blockEndLocStart,
            end: node.blockEndLocEnd,
          },
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlTagOpen: {
        builder.open(toHtmlElement(node, options));
        break;
      }

      case ConcreteNodeTypes.HtmlTagClose: {
        if (isAcceptableDanglingMarkerClose(builder, cst as LiquidHtmlCST, i, options.mode)) {
          builder.push(toHtmlDanglingMarkerClose(node, options));
        } else {
          builder.close(node, NodeTypes.HtmlElement);
        }
        break;
      }

      case ConcreteNodeTypes.HtmlVoidElement: {
        builder.push(toHtmlVoidElement(node, options));
        break;
      }

      case ConcreteNodeTypes.HtmlSelfClosingElement: {
        builder.push(toHtmlSelfClosingElement(node, options));
        break;
      }

      case ConcreteNodeTypes.HtmlDoctype: {
        builder.push({
          type: NodeTypes.HtmlDoctype,
          legacyDoctypeString: node.legacyDoctypeString,
          position: position(node),
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlComment: {
        builder.push({
          type: NodeTypes.HtmlComment,
          body: node.body,
          position: position(node),
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.HtmlRawTag: {
        builder.push({
          type: NodeTypes.HtmlRawNode,
          name: node.name,
          body: toRawMarkup(node, options),
          attributes: toAttributes(node.attrList || [], options),
          position: position(node),
          source: node.source,
          blockStartPosition: {
            start: node.blockStartLocStart,
            end: node.blockStartLocEnd,
          },
          blockEndPosition: {
            start: node.blockEndLocStart,
            end: node.blockEndLocEnd,
          },
        });
        break;
      }

      case ConcreteNodeTypes.AttrEmpty: {
        builder.push({
          type: NodeTypes.AttrEmpty,
          name: cstToAst(node.name, options) as (TextNode | LiquidVariableOutput)[],
          position: position(node),
          source: node.source,
        });
        break;
      }

      case ConcreteNodeTypes.AttrSingleQuoted:
      case ConcreteNodeTypes.AttrDoubleQuoted:
      case ConcreteNodeTypes.AttrUnquoted: {
        const abstractNode: AttrUnquoted | AttrSingleQuoted | AttrDoubleQuoted = {
          type: node.type as unknown as
            | NodeTypes.AttrSingleQuoted
            | NodeTypes.AttrDoubleQuoted
            | NodeTypes.AttrUnquoted,
          name: cstToAst(node.name, options) as (TextNode | LiquidVariableOutput)[],
          position: position(node),
          source: node.source,

          // placeholders
          attributePosition: { start: -1, end: -1 },
          value: [],
        };
        const value = toAttributeValue(node.value, options);
        abstractNode.value = value;
        abstractNode.attributePosition = toAttributePosition(node, value);
        builder.push(abstractNode);
        break;
      }

      case ConcreteNodeTypes.YAMLFrontmatter: {
        builder.push({
          type: NodeTypes.YAMLFrontmatter,
          body: node.body,
          position: position(node),
          source: node.source,
        });
        break;
      }

      default: {
        assertNever(node);
      }
    }
  }

  return builder;
}

function nameLength(names: (ConcreteLiquidVariableOutput | ConcreteTextNode)[]) {
  const start = names.at(0)!;
  const end = names.at(-1)!;
  return end.locEnd - start.locStart;
}

function toAttributePosition(
  node: ConcreteAttrSingleQuoted | ConcreteAttrDoubleQuoted | ConcreteAttrUnquoted,
  value: (LiquidNode | TextNode)[],
): Position {
  if (value.length === 0) {
    // This is bugged when there's whitespace on either side. But I don't
    // think it's worth solving.
    return {
      start: node.locStart + nameLength(node.name) + '='.length + '"'.length,
      // name=""
      // 012345678
      // 0 + 4 + 1 + 1
      // = 6
      end: node.locStart + nameLength(node.name) + '='.length + '"'.length,
      // name=""
      // 012345678
      // 0 + 4 + 1 + 2
      // = 6
    };
  }

  return {
    start: value[0].position.start,
    end: value[value.length - 1].position.end,
  };
}

function toAttributeValue(
  value: (ConcreteLiquidNode | ConcreteTextNode)[],
  options: ASTBuildOptions,
): (LiquidNode | TextNode)[] {
  return cstToAst(value, options) as (LiquidNode | TextNode)[];
}

function toAttributes(
  attrList: ConcreteAttributeNode[],
  options: ASTBuildOptions,
): AttributeNode[] {
  return cstToAst(attrList, options) as AttributeNode[];
}

function liquidTagBaseAttributes(
  node: ConcreteLiquidTag | ConcreteLiquidTagOpen,
): Omit<LiquidTag, 'name' | 'markup'> {
  return {
    type: NodeTypes.LiquidTag,
    position: position(node),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    blockStartPosition: position(node),
    source: node.source,
  };
}

function liquidBranchBaseAttributes(
  node: ConcreteLiquidTag,
): Omit<LiquidBranch, 'name' | 'markup'> {
  return {
    type: NodeTypes.LiquidBranch,
    children: [],
    position: position(node),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    blockStartPosition: position(node),
    blockEndPosition: { start: -1, end: -1 },
    source: node.source,
  };
}

function toLiquidTag(
  node: ConcreteLiquidTag | ConcreteLiquidTagOpen,
  options: ASTBuildOptions & { isBlockTag: boolean },
): LiquidTag | LiquidBranch {
  if (typeof node.markup !== 'string') {
    return toNamedLiquidTag(node as ConcreteLiquidTagNamed, options);
  } else if (isConcreteLiquidBranchDisguisedAsTag(node)) {
    // `elsif`, `else`, `case`, but with unparseable markup.
    return toNamedLiquidBranchBaseCase(node);
  } else if (options.isBlockTag) {
    return {
      name: node.name,
      markup: markup(node.name, node.markup),
      children: options.isBlockTag ? [] : undefined,
      ...liquidTagBaseAttributes(node),
    };
  }
  return {
    name: node.name,
    markup: markup(node.name, node.markup),
    ...liquidTagBaseAttributes(node),
  };
}

function toNamedLiquidTag(
  node: ConcreteLiquidTagNamed | ConcreteLiquidTagOpenNamed,
  options: ASTBuildOptions,
): LiquidTagNamed | LiquidBranchNamed {
  switch (node.name) {
    case NamedTags.echo: {
      return {
        ...liquidTagBaseAttributes(node),
        name: NamedTags.echo,
        markup: toLiquidVariable(node.markup),
      };
    }

    case NamedTags.assign: {
      return {
        ...liquidTagBaseAttributes(node),
        name: NamedTags.assign,
        markup: toAssignMarkup(node.markup),
      };
    }

    case NamedTags.cycle: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toCycleMarkup(node.markup),
      };
    }

    case NamedTags.increment:
    case NamedTags.decrement: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toExpression(node.markup) as LiquidVariableLookup,
      };
    }

    case NamedTags.capture: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toExpression(node.markup) as LiquidVariableLookup,
        children: [],
      };
    }

    case NamedTags.content_for: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toContentForMarkup(node.markup),
      };
    }

    case NamedTags.include:
    case NamedTags.render: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toRenderMarkup(node.markup),
      };
    }

    case NamedTags.layout:
    case NamedTags.section: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toExpression(node.markup) as LiquidString,
      };
    }
    case NamedTags.sections: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toExpression(node.markup) as LiquidString,
      };
    }

    case NamedTags.form: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: node.markup.map(toLiquidArgument),
        children: [],
      };
    }

    case NamedTags.tablerow:
    case NamedTags.for: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toForMarkup(node.markup),
        children: [],
      };
    }

    case NamedTags.paginate: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toPaginateMarkup(node.markup),
        children: [],
      };
    }

    case NamedTags.if:
    case NamedTags.unless: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toConditionalExpression(node.markup),
        blockEndPosition: { start: -1, end: -1 },
        children: [],
      };
    }

    case NamedTags.elsif: {
      return {
        ...liquidBranchBaseAttributes(node),
        name: node.name,
        markup: toConditionalExpression(node.markup),
      };
    }

    case NamedTags.case: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: toExpression(node.markup),
        children: [],
      };
    }

    case NamedTags.when: {
      return {
        ...liquidBranchBaseAttributes(node),
        name: node.name,
        markup: node.markup.map(toExpression),
      };
    }

    case NamedTags.liquid: {
      return {
        ...liquidTagBaseAttributes(node),
        name: node.name,
        markup: cstToAst(node.markup, options) as LiquidStatement[],
      };
    }

    default: {
      return assertNever(node);
    }
  }
}

function toNamedLiquidBranchBaseCase(node: ConcreteLiquidTagBaseCase): LiquidBranchBaseCase {
  return {
    name: node.name,
    type: NodeTypes.LiquidBranch,
    markup: node.name !== 'else' ? node.markup : '', // stripping superfluous else stuff...
    position: { start: node.locStart, end: node.locEnd },
    children: [],
    blockStartPosition: { start: node.locStart, end: node.locEnd },
    blockEndPosition: { start: -1, end: -1 },
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    source: node.source,
  };
}

function toUnnamedLiquidBranch(parentNode: LiquidHtmlNode): LiquidBranchUnnamed {
  return {
    type: NodeTypes.LiquidBranch,
    name: null,
    markup: '',
    position: { start: parentNode.position.end, end: parentNode.position.end },
    blockStartPosition: { start: parentNode.position.end, end: parentNode.position.end },
    blockEndPosition: { start: -1, end: -1 },
    children: [],
    whitespaceStart: '',
    whitespaceEnd: '',
    source: parentNode.source,
  };
}

function toAssignMarkup(node: ConcreteLiquidTagAssignMarkup): AssignMarkup {
  return {
    type: NodeTypes.AssignMarkup,
    name: node.name,
    value: toLiquidVariable(node.value),
    position: position(node),
    source: node.source,
  };
}

function toCycleMarkup(node: ConcreteLiquidTagCycleMarkup): CycleMarkup {
  return {
    type: NodeTypes.CycleMarkup,
    groupName: node.groupName ? toExpression(node.groupName) : null,
    args: node.args.map(toExpression),
    position: position(node),
    source: node.source,
  };
}

function toForMarkup(node: ConcreteLiquidTagForMarkup): ForMarkup {
  return {
    type: NodeTypes.ForMarkup,
    variableName: node.variableName,
    collection: toExpression(node.collection),
    args: node.args.map(toNamedArgument),
    reversed: !!node.reversed,
    position: position(node),
    source: node.source,
  };
}

function toPaginateMarkup(node: ConcretePaginateMarkup): PaginateMarkup {
  return {
    type: NodeTypes.PaginateMarkup,
    collection: toExpression(node.collection),
    pageSize: toExpression(node.pageSize),
    position: position(node),
    args: node.args ? node.args.map(toNamedArgument) : [],
    source: node.source,
  };
}

function toRawMarkup(
  node: ConcreteHtmlRawTag | ConcreteLiquidRawTag,
  options: ASTBuildOptions,
): RawMarkup {
  return {
    type: NodeTypes.RawMarkup,
    kind: toRawMarkupKind(node),
    nodes: cstToAst(node.children, options) as (TextNode | LiquidNode)[],
    value: node.body,
    position: {
      start: node.blockStartLocEnd,
      end: node.blockEndLocStart,
    },
    source: node.source,
  };
}

function toRawMarkupKind(node: ConcreteHtmlRawTag | ConcreteLiquidRawTag): RawMarkupKinds {
  switch (node.type) {
    case ConcreteNodeTypes.HtmlRawTag:
      return toRawMarkupKindFromHtmlNode(node);
    case ConcreteNodeTypes.LiquidRawTag:
      return toRawMarkupKindFromLiquidNode(node);
    default:
      return assertNever(node);
  }
}

const liquidToken = /(\{%|\{\{)-?/g;

function toRawMarkupKindFromHtmlNode(node: ConcreteHtmlRawTag): RawMarkupKinds {
  switch (node.name) {
    case 'script': {
      const scriptAttr = node.attrList?.find(
        (attr) =>
          'name' in attr &&
          typeof attr.name !== 'string' &&
          attr.name.length === 1 &&
          attr.name[0].type === ConcreteNodeTypes.TextNode &&
          attr.name[0].value === 'type',
      );

      if (
        !scriptAttr ||
        !('value' in scriptAttr) ||
        scriptAttr.value.length === 0 ||
        scriptAttr.value[0].type !== ConcreteNodeTypes.TextNode
      ) {
        return RawMarkupKinds.javascript;
      }
      const type = scriptAttr.value[0].value;

      if (type === 'text/markdown') {
        return RawMarkupKinds.markdown;
      }

      if (type === 'application/x-typescript') {
        return RawMarkupKinds.typescript;
      }

      if (type === 'text/html') {
        return RawMarkupKinds.html;
      }

      if (
        (type && (type.endsWith('json') || type.endsWith('importmap'))) ||
        type === 'speculationrules'
      ) {
        return RawMarkupKinds.json;
      }

      return RawMarkupKinds.javascript;
    }
    case 'style':
      if (liquidToken.test(node.body)) {
        return RawMarkupKinds.text;
      }
      return RawMarkupKinds.css;
    default:
      return RawMarkupKinds.text;
  }
}

function toRawMarkupKindFromLiquidNode(node: ConcreteLiquidRawTag): RawMarkupKinds {
  switch (node.name) {
    case 'javascript':
      return RawMarkupKinds.javascript;
    case 'stylesheet':
    case 'style':
      if (liquidToken.test(node.body)) {
        return RawMarkupKinds.text;
      }
      return RawMarkupKinds.css;
    case 'schema':
      return RawMarkupKinds.json;
    default:
      return RawMarkupKinds.text;
  }
}

function toContentForMarkup(node: ConcreteLiquidTagContentForMarkup): ContentForMarkup {
  return {
    type: NodeTypes.ContentForMarkup,
    contentForType: toExpression(node.contentForType) as LiquidString,
    args: node.args.map(toNamedArgument),
    position: position(node),
    source: node.source,
  };
}

function toRenderMarkup(node: ConcreteLiquidTagRenderMarkup): RenderMarkup {
  return {
    type: NodeTypes.RenderMarkup,
    snippet: toExpression(node.snippet) as LiquidString | LiquidVariableLookup,
    alias: node.alias,
    variable: toRenderVariableExpression(node.variable),
    args: node.args.map(toNamedArgument),
    position: position(node),
    source: node.source,
  };
}

function toRenderVariableExpression(
  node: ConcreteRenderVariableExpression | null,
): RenderVariableExpression | null {
  if (!node) return null;
  return {
    type: NodeTypes.RenderVariableExpression,
    kind: node.kind,
    name: toExpression(node.name),
    position: position(node),
    source: node.source,
  };
}

function toConditionalExpression(nodes: ConcreteLiquidCondition[]): LiquidConditionalExpression {
  if (nodes.length === 1) {
    return toComparisonOrExpression(nodes[0]);
  }

  const [first, second] = nodes;
  const [, ...rest] = nodes;
  return {
    type: NodeTypes.LogicalExpression,
    relation: second.relation as 'and' | 'or',
    left: toComparisonOrExpression(first),
    right: toConditionalExpression(rest),
    position: {
      start: first.locStart,
      end: nodes[nodes.length - 1].locEnd,
    },
    source: first.source,
  };
}

function toComparisonOrExpression(
  node: ConcreteLiquidCondition,
): LiquidComparison | LiquidExpression {
  const expression = node.expression;
  switch (expression.type) {
    case ConcreteNodeTypes.Comparison:
      return toComparison(expression);
    default:
      return toExpression(expression);
  }
}

function toComparison(node: ConcreteLiquidComparison): LiquidComparison {
  return {
    type: NodeTypes.Comparison,
    comparator: node.comparator,
    left: toExpression(node.left),
    right: toExpression(node.right),
    position: position(node),
    source: node.source,
  };
}

function toLiquidVariableOutput(node: ConcreteLiquidVariableOutput): LiquidVariableOutput {
  return {
    type: NodeTypes.LiquidVariableOutput,
    markup: typeof node.markup === 'string' ? node.markup : toLiquidVariable(node.markup),
    whitespaceStart: node.whitespaceStart ?? '',
    whitespaceEnd: node.whitespaceEnd ?? '',
    position: position(node),
    source: node.source,
  };
}

function toLiquidVariable(node: ConcreteLiquidVariable): LiquidVariable {
  return {
    type: NodeTypes.LiquidVariable,
    expression: toExpression(node.expression),
    filters: node.filters.map(toFilter),
    position: position(node),
    rawSource: node.rawSource,
    source: node.source,
  };
}

function toExpression(node: ConcreteLiquidExpression): LiquidExpression {
  switch (node.type) {
    case ConcreteNodeTypes.String: {
      return {
        type: NodeTypes.String,
        position: position(node),
        single: node.single,
        value: node.value,
        source: node.source,
      };
    }
    case ConcreteNodeTypes.Number: {
      return {
        type: NodeTypes.Number,
        position: position(node),
        value: node.value,
        source: node.source,
      };
    }
    case ConcreteNodeTypes.LiquidLiteral: {
      return {
        type: NodeTypes.LiquidLiteral,
        position: position(node),
        value: node.value,
        keyword: node.keyword,
        source: node.source,
      };
    }
    case ConcreteNodeTypes.Range: {
      return {
        type: NodeTypes.Range,
        start: toExpression(node.start),
        end: toExpression(node.end),
        position: position(node),
        source: node.source,
      };
    }
    case ConcreteNodeTypes.VariableLookup: {
      return {
        type: NodeTypes.VariableLookup,
        name: node.name,
        lookups: node.lookups.map(toExpression),
        position: position(node),
        source: node.source,
      };
    }
    default: {
      return assertNever(node);
    }
  }
}

function toFilter(node: ConcreteLiquidFilter): LiquidFilter {
  return {
    type: NodeTypes.LiquidFilter,
    name: node.name,
    args: node.args.map(toLiquidArgument),
    position: position(node),
    source: node.source,
  };
}

function toLiquidArgument(node: ConcreteLiquidArgument): LiquidArgument {
  switch (node.type) {
    case ConcreteNodeTypes.NamedArgument: {
      return toNamedArgument(node);
    }
    default: {
      return toExpression(node);
    }
  }
}

function toNamedArgument(node: ConcreteLiquidNamedArgument): LiquidNamedArgument {
  return {
    type: NodeTypes.NamedArgument,
    name: node.name,
    value: toExpression(node.value),
    position: position(node),
    source: node.source,
  };
}

function toHtmlElement(node: ConcreteHtmlTagOpen, options: ASTBuildOptions): HtmlElement {
  return {
    type: NodeTypes.HtmlElement,
    name: cstToAst(node.name, options) as (TextNode | LiquidVariableOutput)[],
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    blockEndPosition: { start: -1, end: -1 },
    children: [],
    source: node.source,
  };
}

function toHtmlDanglingMarkerClose(
  node: ConcreteHtmlTagClose,
  options: ASTBuildOptions,
): HtmlDanglingMarkerClose {
  return {
    type: NodeTypes.HtmlDanglingMarkerClose,
    name: cstToAst(node.name, options) as (TextNode | LiquidVariableOutput)[],
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toHtmlVoidElement(
  node: ConcreteHtmlVoidElement,
  options: ASTBuildOptions,
): HtmlVoidElement {
  return {
    type: NodeTypes.HtmlVoidElement,
    name: node.name,
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toHtmlSelfClosingElement(
  node: ConcreteHtmlSelfClosingElement,
  options: ASTBuildOptions,
): HtmlSelfClosingElement {
  return {
    type: NodeTypes.HtmlSelfClosingElement,
    name: cstToAst(node.name, options) as (TextNode | LiquidVariableOutput)[],
    attributes: toAttributes(node.attrList || [], options),
    position: position(node),
    blockStartPosition: position(node),
    source: node.source,
  };
}

function toTextNode(node: ConcreteTextNode): TextNode {
  return {
    type: NodeTypes.TextNode,
    value: node.value,
    position: position(node),
    source: node.source,
  };
}

function isAcceptableDanglingMarkerClose(
  builder: ASTBuilder,
  cst: LiquidHtmlCST,
  currIndex: number,
  mode: ASTBuildOptions['mode'],
): boolean {
  if (mode === 'completion') {
    const current = cst[currIndex] as ConcreteHtmlTagClose;
    const parentIsOfCorrectName =
      builder.parent &&
      builder.parent.type === NodeTypes.HtmlElement &&
      getName(builder.parent) === getName(current);
    return !parentIsOfCorrectName;
  }

  return isAcceptableDanglingMarker(builder);
}

// This function checks that the builder.current node accepts dangling nodes.
//
// The current logic is:
//  - Grandparent node must be an if-like statement
//  - Parent node must be a LiquidBranch
function isAcceptableDanglingMarker(builder: ASTBuilder): boolean {
  const { parent, grandparent } = builder;
  if (!parent || !grandparent) return false;
  return (
    parent.type === NodeTypes.LiquidBranch &&
    grandparent.type === NodeTypes.LiquidTag &&
    ['if', 'unless', 'case'].includes(grandparent.name)
  );
}

// checking that is a {% else %} or {% endif %}
function isConcreteExceptionEnd(node: LiquidHtmlConcreteNode | undefined) {
  return (
    !node ||
    node.type === ConcreteNodeTypes.LiquidTagClose ||
    isConcreteLiquidBranchDisguisedAsTag(node)
  );
}

function markup(name: string, markup: string) {
  if (TAGS_WITHOUT_MARKUP.includes(name)) return '';
  return markup;
}

function position(node: HasPosition): Position {
  return {
    start: node.locStart,
    end: node.locEnd,
  };
}

export function walk(
  ast: LiquidHtmlNode,
  fn: (ast: LiquidHtmlNode, parentNode: LiquidHtmlNode | undefined) => void,
  parentNode?: LiquidHtmlNode,
) {
  for (const key of Object.keys(ast)) {
    if (nonTraversableProperties.has(key)) {
      continue;
    }

    const value = (ast as any)[key];
    if (Array.isArray(value)) {
      value.filter(isLiquidHtmlNode).forEach((node: LiquidHtmlNode) => walk(node, fn, ast));
    } else if (isLiquidHtmlNode(value)) {
      walk(value, fn, ast);
    }
  }

  fn(ast, parentNode);
}

export function isLiquidHtmlNode(value: any): value is LiquidHtmlNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    NodeTypes.hasOwnProperty(value.type)
  );
}

function getUnclosed(node?: ParentNode, parentNode?: ParentNode): UnclosedNode | undefined {
  if (!node) return undefined;
  if (getName(node) === null && parentNode) {
    node = parentNode;
  }
  return {
    type: node.type,
    name: getName(node) ?? '',
    blockStartPosition: 'blockStartPosition' in node ? node.blockStartPosition : node.position,
  };
}
