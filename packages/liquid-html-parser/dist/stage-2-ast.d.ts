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
import { ConcreteAttributeNode, ConcreteHtmlTagClose, ConcreteLiquidTagClose, LiquidCST, LiquidHtmlCST, ConcreteLiquidLiteral } from './stage-1-cst';
import { Comparators, NamedTags, NodeTypes, Position } from './types';
/** The union type of all possible node types inside a LiquidHTML AST. */
export type LiquidHtmlNode = DocumentNode | YAMLFrontmatter | LiquidNode | HtmlDoctype | HtmlNode | AttributeNode | LiquidVariable | ComplexLiquidExpression | LiquidFilter | LiquidNamedArgument | AssignMarkup | ContentForMarkup | CycleMarkup | ForMarkup | RenderMarkup | PaginateMarkup | RawMarkup | RenderVariableExpression | RenderAliasExpression | LiquidLogicalExpression | LiquidComparison | TextNode | LiquidDocParamNode | LiquidDocExampleNode | LiquidDocPromptNode | LiquidDocDescriptionNode;
/** The root node of all LiquidHTML ASTs. */
export interface DocumentNode extends ASTNode<NodeTypes.Document> {
    children: LiquidHtmlNode[];
    name: '#document';
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
export type ParentNode = Extract<LiquidHtmlNode, HasChildren | HasAttributes | HasValue | HasName | HasCompoundName>;
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
export type LiquidTagNamed = LiquidTagAssign | LiquidTagCase | LiquidTagCapture | LiquidTagContentFor | LiquidTagCycle | LiquidTagDecrement | LiquidTagEcho | LiquidTagFor | LiquidTagForm | LiquidTagIf | LiquidTagInclude | LiquidTagIncrement | LiquidTagLayout | LiquidTagLiquid | LiquidTagPaginate | LiquidTagRender | LiquidTagSection | LiquidTagSections | LiquidTagTablerow | LiquidTagUnless;
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
export interface LiquidTagBaseCase extends LiquidTagNode<string, string> {
}
/** https://shopify.dev/docs/api/liquid/tags#echo */
export interface LiquidTagEcho extends LiquidTagNode<NamedTags.echo, LiquidVariable> {
}
/** https://shopify.dev/docs/api/liquid/tags#assign */
export interface LiquidTagAssign extends LiquidTagNode<NamedTags.assign, AssignMarkup> {
}
/** {% assign name = value %} */
export interface AssignMarkup extends ASTNode<NodeTypes.AssignMarkup> {
    /** the name of the variable that is being assigned */
    name: string;
    /** the value of the variable that is being assigned */
    value: LiquidVariable;
}
/** https://shopify.dev/docs/api/liquid/tags#increment */
export interface LiquidTagIncrement extends LiquidTagNode<NamedTags.increment, LiquidVariableLookup> {
}
/** https://shopify.dev/docs/api/liquid/tags#decrement */
export interface LiquidTagDecrement extends LiquidTagNode<NamedTags.decrement, LiquidVariableLookup> {
}
/** https://shopify.dev/docs/api/liquid/tags#capture */
export interface LiquidTagCapture extends LiquidTagNode<NamedTags.capture, LiquidVariableLookup> {
}
/** https://shopify.dev/docs/api/liquid/tags#cycle */
export interface LiquidTagCycle extends LiquidTagNode<NamedTags.cycle, CycleMarkup> {
}
/** {% cycle [groupName:] arg1, arg2, arg3 %} */
export interface CycleMarkup extends ASTNode<NodeTypes.CycleMarkup> {
    /** {% cycle groupName: arg1, arg2, arg3 %} */
    groupName: LiquidExpression | null;
    /** {% cycle arg1, arg2, arg3, ... %} */
    args: LiquidExpression[];
}
/** https://shopify.dev/docs/api/liquid/tags#case */
export interface LiquidTagCase extends LiquidTagNode<NamedTags.case, LiquidExpression> {
}
/**
 * {% when expression1, expression2 or expression3 %}
 *   children
 */
export interface LiquidBranchWhen extends LiquidBranchNode<NamedTags.when, LiquidExpression[]> {
}
/** https://shopify.dev/docs/api/liquid/tags#form */
export interface LiquidTagForm extends LiquidTagNode<NamedTags.form, LiquidArgument[]> {
}
/** https://shopify.dev/docs/api/liquid/tags#for */
export interface LiquidTagFor extends LiquidTagNode<NamedTags.for, ForMarkup> {
}
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
export interface LiquidTagTablerow extends LiquidTagNode<NamedTags.tablerow, ForMarkup> {
}
/** https://shopify.dev/docs/api/liquid/tags#if */
export interface LiquidTagIf extends LiquidTagConditional<NamedTags.if> {
}
/** https://shopify.dev/docs/api/liquid/tags#unless */
export interface LiquidTagUnless extends LiquidTagConditional<NamedTags.unless> {
}
/** {% elsif cond %} */
export interface LiquidBranchElsif extends LiquidBranchNode<NamedTags.elsif, LiquidConditionalExpression> {
}
export interface LiquidTagConditional<Name> extends LiquidTagNode<Name, LiquidConditionalExpression> {
}
/** The union type of all conditional expression nodes */
export type LiquidConditionalExpression = LiquidLogicalExpression | LiquidComparison | LiquidExpression;
/** Represents `left (and|or) right` conditional expressions */
export interface LiquidLogicalExpression extends ASTNode<NodeTypes.LogicalExpression> {
    relation: 'and' | 'or';
    left: LiquidConditionalExpression;
    right: LiquidConditionalExpression;
}
/** Represents `left (<|<=|=|>=|>|contains) right` conditional expressions */
export interface LiquidComparison extends ASTNode<NodeTypes.Comparison> {
    comparator: Comparators;
    left: LiquidExpression;
    right: LiquidExpression;
}
/** https://shopify.dev/docs/api/liquid/tags#paginate */
export interface LiquidTagPaginate extends LiquidTagNode<NamedTags.paginate, PaginateMarkup> {
}
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
export interface LiquidTagContentFor extends LiquidTagNode<NamedTags.content_for, ContentForMarkup> {
}
/** https://shopify.dev/docs/api/liquid/tags#render */
export interface LiquidTagRender extends LiquidTagNode<NamedTags.render, RenderMarkup> {
}
/** https://shopify.dev/docs/api/liquid/tags#include */
export interface LiquidTagInclude extends LiquidTagNode<NamedTags.include, RenderMarkup> {
}
/** https://shopify.dev/docs/api/liquid/tags#section */
export interface LiquidTagSection extends LiquidTagNode<NamedTags.section, LiquidString> {
}
/** https://shopify.dev/docs/api/liquid/tags#sections */
export interface LiquidTagSections extends LiquidTagNode<NamedTags.sections, LiquidString> {
}
/** https://shopify.dev/docs/api/liquid/tags#layout */
export interface LiquidTagLayout extends LiquidTagNode<NamedTags.layout, LiquidExpression> {
}
/** https://shopify.dev/docs/api/liquid/tags#liquid */
export interface LiquidTagLiquid extends LiquidTagNode<NamedTags.liquid, LiquidStatement[]> {
}
/** {% content_for 'contentForType' [...namedArguments] %} */
export interface ContentForMarkup extends ASTNode<NodeTypes.ContentForMarkup> {
    /** {% content_for 'contentForType' %} */
    contentForType: LiquidString;
    /**
     * WARNING: `args` could contain LiquidVariableLookup when we are in a completion context
     * because the NamedArgument isn't fully typed out.
     * E.g. {% content_for 'contentForType', arg1: value1, arg2█ %}
     *
     * @example {% content_for 'contentForType', arg1: value1, arg2: value2 %}
     */
    args: LiquidNamedArgument[];
}
/** {% render 'snippet' [(with|for) variable [as alias]], [...namedArguments] %} */
export interface RenderMarkup extends ASTNode<NodeTypes.RenderMarkup> {
    /** {% render snippet %} */
    snippet: LiquidString | LiquidVariableLookup;
    /** {% render 'snippet' with thing as alias %} */
    alias: RenderAliasExpression | null;
    /** {% render 'snippet' [with variable] %} */
    variable: RenderVariableExpression | null;
    /**
     * WARNING: `args` could contain LiquidVariableLookup when we are in a completion context
     * because the NamedArgument isn't fully typed out.
     * E.g. {% render 'snippet', arg1: value1, arg2█ %}
     *
     * @example {% render 'snippet', arg1: value1, arg2: value2 %}
     */
    args: LiquidNamedArgument[];
}
/** Represents the `for name` or `with name` expressions in render nodes */
export interface RenderVariableExpression extends ASTNode<NodeTypes.RenderVariableExpression> {
    /** {% render 'snippet' (for|with) name %} */
    kind: 'for' | 'with';
    /** {% render 'snippet' (for|with) name %} */
    name: LiquidExpression;
}
/** Represents the `as name` expressions in render nodes */
export interface RenderAliasExpression extends ASTNode<NodeTypes.RenderAliasExpression> {
    /** {% render 'snippet' for array as name %}` or `{% render 'snippet' with object as name %} */
    value: string;
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
export interface LiquidBranchUnnamed extends LiquidBranchNode<null, string> {
}
/** Loosely typed LiquidBranch nodes. Markup is a string because we can't strictly parse it. */
export interface LiquidBranchBaseCase extends LiquidBranchNode<string, string> {
}
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
    expression: ComplexLiquidExpression;
    /** expression | filter1 | filter2 */
    filters: LiquidFilter[];
    /** Used internally */
    rawSource: string;
}
/** The union type of all Liquid expression nodes */
export type LiquidExpression = LiquidString | LiquidNumber | LiquidLiteral | LiquidRange | LiquidVariableLookup;
export type ComplexLiquidExpression = LiquidBooleanExpression | LiquidExpression;
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
export interface LiquidBooleanExpression extends ASTNode<NodeTypes.BooleanExpression> {
    condition: LiquidConditionalExpression;
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
export type HtmlNode = HtmlComment | HtmlElement | HtmlDanglingMarkerClose | HtmlVoidElement | HtmlSelfClosingElement | HtmlRawNode;
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
export declare enum RawMarkupKinds {
    css = "css",
    html = "html",
    javascript = "javascript",
    json = "json",
    markdown = "markdown",
    typescript = "typescript",
    text = "text"
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
export type AttributeNode = LiquidNode | AttrSingleQuoted | AttrDoubleQuoted | AttrUnquoted | AttrEmpty;
/** `<tag attr='single quoted'>` */
export interface AttrSingleQuoted extends AttributeNodeBase<NodeTypes.AttrSingleQuoted> {
}
/** `<tag attr="double quoted">` */
export interface AttrDoubleQuoted extends AttributeNodeBase<NodeTypes.AttrDoubleQuoted> {
}
/** `<tag attr=unquoted>` */
export interface AttrUnquoted extends AttributeNodeBase<NodeTypes.AttrUnquoted> {
}
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
/** Represents a `@param` node in a LiquidDoc comment - `@param {paramType} [paramName]  - paramDescription` */
export interface LiquidDocParamNode extends ASTNode<NodeTypes.LiquidDocParamNode> {
    name: 'param';
    /** The name of the parameter (e.g. "product"). Only includes the name, not the optional delimiters or whitespace. */
    paramName: TextNode;
    /** Optional description of the parameter in a Liquid doc comment (e.g. "The product title") */
    paramDescription: TextNode | null;
    /** Optional type annotation for the parameter (e.g. "{string}", "{number}") */
    paramType: TextNode | null;
    /** Whether this parameter must be passed when using the snippet */
    required: boolean;
}
/** Represents a `@description` node in a LiquidDoc comment - `@description descriptionContent` */
export interface LiquidDocDescriptionNode extends ASTNode<NodeTypes.LiquidDocDescriptionNode> {
    name: 'description';
    /** The contents of the description (e.g. "This is a description"). Can be multiline. */
    content: TextNode;
    /** Whether this description is implicit (e.g. not appended by a @description annotation) */
    isImplicit: boolean;
    /** Whether this description starts on the same line as the @description annotation. This is false for implicit descriptions. */
    isInline: boolean;
}
/** Represents a `@example` node in a LiquidDoc comment - `@example exampleContent` */
export interface LiquidDocExampleNode extends ASTNode<NodeTypes.LiquidDocExampleNode> {
    name: 'example';
    /** The contents of the example (e.g. "{{ product }}"). Can be multiline. */
    content: TextNode;
    /** Whether this example starts on the same line as the @example annotation.  */
    isInline: boolean;
}
/** Represents a `@prompt` node in a LiquidDoc comment - `@prompt promptContent` */
export interface LiquidDocPromptNode extends ASTNode<NodeTypes.LiquidDocPromptNode> {
    name: 'prompt';
    /** The contents of the prompt (e.g. "Build me a sale sticker for my shop with a rotating @ symbol"). Can be multiline. */
    content: TextNode;
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
export declare function isBranchedTag(node: LiquidHtmlNode): boolean;
export declare function toLiquidAST(source: string, options?: ASTBuildOptions): DocumentNode;
export declare function toLiquidHtmlAST(source: string, options?: ASTBuildOptions): DocumentNode;
export declare function getName(node: ConcreteLiquidTagClose | ConcreteHtmlTagClose | ParentNode | undefined): string | null;
export declare function cstToAst(cst: LiquidHtmlCST | LiquidCST | ConcreteAttributeNode[], options: ASTBuildOptions): LiquidHtmlNode[];
export declare function walk(ast: LiquidHtmlNode, fn: (ast: LiquidHtmlNode, parentNode: LiquidHtmlNode | undefined) => void, parentNode?: LiquidHtmlNode): void;
export declare function isLiquidHtmlNode(value: any): value is LiquidHtmlNode;
export {};
