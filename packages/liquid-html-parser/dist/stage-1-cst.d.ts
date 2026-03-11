/**
 * This is the first stage of the parser.
 *
 * Input:
 *   Source code: string
 *
 * Output:
 *   Concrete Syntax Tree (CST): LiquidHtmlCST
 *
 * We use OhmJS's toAST method to turn the OhmJS nodes into an "almost-AST." We
 * call that a Concrete Syntax Tree because it considers Open and Close nodes as
 * separate nodes.
 *
 * It is mostly "flat."
 *
 * e.g.
 * {% if cond %}hi <em>there!</em>{% endif %}
 *
 * becomes
 * - LiquidTagOpen/if
 *   condition: LiquidVariableExpression/cond
 * - TextNode/"hi "
 * - HtmlTagOpen/em
 * - TextNode/"there!"
 * - HtmlTagClose/em
 * - LiquidTagClose/if
 *
 * In the Concrete Syntax Tree, all nodes are siblings instead of having a
 * parent/children relationship.
 *
 */
import { Parser } from 'prettier';
import { Comparators, NamedTags } from './types';
export declare enum ConcreteNodeTypes {
    HtmlDoctype = "HtmlDoctype",
    HtmlComment = "HtmlComment",
    HtmlRawTag = "HtmlRawTag",
    HtmlVoidElement = "HtmlVoidElement",
    HtmlSelfClosingElement = "HtmlSelfClosingElement",
    HtmlTagOpen = "HtmlTagOpen",
    HtmlTagClose = "HtmlTagClose",
    AttrSingleQuoted = "AttrSingleQuoted",
    AttrDoubleQuoted = "AttrDoubleQuoted",
    AttrUnquoted = "AttrUnquoted",
    AttrEmpty = "AttrEmpty",
    LiquidVariableOutput = "LiquidVariableOutput",
    LiquidRawTag = "LiquidRawTag",
    LiquidTag = "LiquidTag",
    LiquidTagOpen = "LiquidTagOpen",
    LiquidTagClose = "LiquidTagClose",
    TextNode = "TextNode",
    YAMLFrontmatter = "YAMLFrontmatter",
    LiquidVariable = "LiquidVariable",
    LiquidFilter = "LiquidFilter",
    NamedArgument = "NamedArgument",
    LiquidLiteral = "LiquidLiteral",
    VariableLookup = "VariableLookup",
    BooleanExpression = "BooleanExpression",
    String = "String",
    Number = "Number",
    Range = "Range",
    Comparison = "Comparison",
    Condition = "Condition",
    AssignMarkup = "AssignMarkup",
    ContentForMarkup = "ContentForMarkup",
    CycleMarkup = "CycleMarkup",
    ForMarkup = "ForMarkup",
    RenderMarkup = "RenderMarkup",
    PaginateMarkup = "PaginateMarkup",
    RenderVariableExpression = "RenderVariableExpression",
    RenderAliasExpression = "RenderAliasExpression",
    ContentForNamedArgument = "ContentForNamedArgument",
    LiquidDocParamNode = "LiquidDocParamNode",
    LiquidDocParamNameNode = "LiquidDocParamNameNode",
    LiquidDocDescriptionNode = "LiquidDocDescriptionNode",
    LiquidDocExampleNode = "LiquidDocExampleNode",
    LiquidDocPromptNode = "LiquidDocPromptNode"
}
export declare const LiquidLiteralValues: {
    nil: null;
    null: null;
    true: true;
    false: false;
    blank: "";
    empty: "";
};
export interface Parsers {
    [astFormat: string]: Parser;
}
export interface ConcreteBasicNode<T> {
    type: T;
    source: string;
    locStart: number;
    locEnd: number;
}
export interface ConcreteLiquidDocParamNode extends ConcreteBasicNode<ConcreteNodeTypes.LiquidDocParamNode> {
    name: 'param';
    paramName: ConcreteLiquidDocParamNameNode;
    paramDescription: ConcreteTextNode | null;
    paramType: ConcreteTextNode | null;
}
export interface ConcreteLiquidDocParamNameNode extends ConcreteBasicNode<ConcreteNodeTypes.LiquidDocParamNameNode> {
    name: 'paramName';
    content: ConcreteTextNode;
    required: boolean;
}
export interface ConcreteLiquidDocDescriptionNode extends ConcreteBasicNode<ConcreteNodeTypes.LiquidDocDescriptionNode> {
    name: 'description';
    content: ConcreteTextNode;
    isImplicit: boolean;
    isInline: boolean;
}
export interface ConcreteLiquidDocExampleNode extends ConcreteBasicNode<ConcreteNodeTypes.LiquidDocExampleNode> {
    name: 'example';
    content: ConcreteTextNode;
    isInline: boolean;
}
export interface ConcreteLiquidDocPromptNode extends ConcreteBasicNode<ConcreteNodeTypes.LiquidDocPromptNode> {
    name: 'prompt';
    content: ConcreteTextNode;
}
export interface ConcreteHtmlNodeBase<T> extends ConcreteBasicNode<T> {
    attrList?: ConcreteAttributeNode[];
}
export interface ConcreteHtmlDoctype extends ConcreteBasicNode<ConcreteNodeTypes.HtmlDoctype> {
    legacyDoctypeString: string | null;
}
export interface ConcreteHtmlComment extends ConcreteBasicNode<ConcreteNodeTypes.HtmlComment> {
    body: string;
}
export interface ConcreteHtmlRawTag extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlRawTag> {
    name: string;
    body: string;
    children: (ConcreteTextNode | ConcreteLiquidNode)[];
    blockStartLocStart: number;
    blockStartLocEnd: number;
    blockEndLocStart: number;
    blockEndLocEnd: number;
}
export interface ConcreteHtmlVoidElement extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlVoidElement> {
    name: string;
}
export interface ConcreteHtmlSelfClosingElement extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlSelfClosingElement> {
    name: (ConcreteTextNode | ConcreteLiquidVariableOutput)[];
}
export interface ConcreteHtmlTagOpen extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlTagOpen> {
    name: (ConcreteTextNode | ConcreteLiquidVariableOutput)[];
}
export interface ConcreteHtmlTagClose extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlTagClose> {
    name: (ConcreteTextNode | ConcreteLiquidVariableOutput)[];
}
export interface ConcreteAttributeNodeBase<T> extends ConcreteBasicNode<T> {
    name: (ConcreteLiquidVariableOutput | ConcreteTextNode)[];
    value: (ConcreteLiquidNode | ConcreteTextNode)[];
}
export type ConcreteAttributeNode = ConcreteLiquidNode | ConcreteAttrSingleQuoted | ConcreteAttrDoubleQuoted | ConcreteAttrUnquoted | ConcreteAttrEmpty;
export interface ConcreteAttrSingleQuoted extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrSingleQuoted> {
}
export interface ConcreteAttrDoubleQuoted extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrDoubleQuoted> {
}
export interface ConcreteAttrUnquoted extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrUnquoted> {
}
export interface ConcreteAttrEmpty extends ConcreteBasicNode<ConcreteNodeTypes.AttrEmpty> {
    name: (ConcreteLiquidVariableOutput | ConcreteTextNode)[];
}
export type ConcreteLiquidNode = ConcreteLiquidRawTag | ConcreteLiquidTagOpen | ConcreteLiquidTagClose | ConcreteLiquidTag | ConcreteLiquidVariableOutput;
interface ConcreteBasicLiquidNode<T> extends ConcreteBasicNode<T> {
    whitespaceStart: null | '-';
    whitespaceEnd: null | '-';
}
export interface ConcreteLiquidRawTag extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidRawTag> {
    name: string;
    body: string;
    children: (ConcreteTextNode | ConcreteLiquidNode)[];
    markup: string;
    delimiterWhitespaceStart: null | '-';
    delimiterWhitespaceEnd: null | '-';
    blockStartLocStart: number;
    blockStartLocEnd: number;
    blockEndLocStart: number;
    blockEndLocEnd: number;
}
export type ConcreteLiquidTagOpen = ConcreteLiquidTagOpenBaseCase | ConcreteLiquidTagOpenNamed;
export type ConcreteLiquidTagOpenNamed = ConcreteLiquidTagOpenCase | ConcreteLiquidTagOpenCapture | ConcreteLiquidTagOpenIf | ConcreteLiquidTagOpenUnless | ConcreteLiquidTagOpenForm | ConcreteLiquidTagOpenFor | ConcreteLiquidTagOpenPaginate | ConcreteLiquidTagOpenTablerow;
export interface ConcreteLiquidTagOpenNode<Name, Markup> extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagOpen> {
    name: Name;
    markup: Markup;
}
export interface ConcreteLiquidTagOpenBaseCase extends ConcreteLiquidTagOpenNode<string, string> {
}
export interface ConcreteLiquidTagOpenCapture extends ConcreteLiquidTagOpenNode<NamedTags.capture, ConcreteLiquidVariableLookup> {
}
export interface ConcreteLiquidTagOpenCase extends ConcreteLiquidTagOpenNode<NamedTags.case, ConcreteLiquidExpression> {
}
export interface ConcreteLiquidTagWhen extends ConcreteLiquidTagNode<NamedTags.when, ConcreteLiquidExpression[]> {
}
export interface ConcreteLiquidTagOpenIf extends ConcreteLiquidTagOpenNode<NamedTags.if, ConcreteLiquidCondition[]> {
}
export interface ConcreteLiquidTagOpenUnless extends ConcreteLiquidTagOpenNode<NamedTags.unless, ConcreteLiquidCondition[]> {
}
export interface ConcreteLiquidTagElsif extends ConcreteLiquidTagNode<NamedTags.elsif, ConcreteLiquidCondition[]> {
}
export interface ConcreteLiquidCondition extends ConcreteBasicNode<ConcreteNodeTypes.Condition> {
    relation: 'and' | 'or' | null;
    expression: ConcreteLiquidComparison | ConcreteLiquidExpression;
}
export interface ConcreteLiquidComparison extends ConcreteBasicNode<ConcreteNodeTypes.Comparison> {
    comparator: Comparators;
    left: ConcreteLiquidExpression;
    right: ConcreteLiquidExpression;
}
export interface ConcreteLiquidTagOpenForm extends ConcreteLiquidTagOpenNode<NamedTags.form, ConcreteLiquidArgument[]> {
}
export interface ConcreteLiquidTagOpenFor extends ConcreteLiquidTagOpenNode<NamedTags.for, ConcreteLiquidTagForMarkup> {
}
export interface ConcreteLiquidTagForMarkup extends ConcreteBasicNode<ConcreteNodeTypes.ForMarkup> {
    variableName: string;
    collection: ConcreteLiquidExpression;
    reversed: 'reversed' | null;
    args: ConcreteLiquidNamedArgument[];
}
export interface ConcreteLiquidTagOpenTablerow extends ConcreteLiquidTagOpenNode<NamedTags.tablerow, ConcreteLiquidTagForMarkup> {
}
export interface ConcreteLiquidTagOpenPaginate extends ConcreteLiquidTagOpenNode<NamedTags.paginate, ConcretePaginateMarkup> {
}
export interface ConcretePaginateMarkup extends ConcreteBasicNode<ConcreteNodeTypes.PaginateMarkup> {
    collection: ConcreteLiquidExpression;
    pageSize: ConcreteLiquidExpression;
    args: ConcreteLiquidNamedArgument[] | null;
}
export interface ConcreteLiquidTagClose extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagClose> {
    name: string;
}
export type ConcreteLiquidTag = ConcreteLiquidTagNamed | ConcreteLiquidTagBaseCase;
export type ConcreteLiquidTagNamed = ConcreteLiquidTagAssign | ConcreteLiquidTagCycle | ConcreteLiquidTagContentFor | ConcreteLiquidTagEcho | ConcreteLiquidTagIncrement | ConcreteLiquidTagDecrement | ConcreteLiquidTagElsif | ConcreteLiquidTagInclude | ConcreteLiquidTagLayout | ConcreteLiquidTagLiquid | ConcreteLiquidTagRender | ConcreteLiquidTagSection | ConcreteLiquidTagSections | ConcreteLiquidTagWhen;
export interface ConcreteLiquidTagNode<Name, Markup> extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTag> {
    markup: Markup;
    name: Name;
}
export interface ConcreteLiquidTagBaseCase extends ConcreteLiquidTagNode<string, string> {
}
export interface ConcreteLiquidTagEcho extends ConcreteLiquidTagNode<NamedTags.echo, ConcreteLiquidVariable> {
}
export interface ConcreteLiquidTagIncrement extends ConcreteLiquidTagNode<NamedTags.increment, ConcreteLiquidVariableLookup> {
}
export interface ConcreteLiquidTagDecrement extends ConcreteLiquidTagNode<NamedTags.decrement, ConcreteLiquidVariableLookup> {
}
export interface ConcreteLiquidTagSection extends ConcreteLiquidTagNode<NamedTags.section, ConcreteStringLiteral> {
}
export interface ConcreteLiquidTagSections extends ConcreteLiquidTagNode<NamedTags.sections, ConcreteStringLiteral> {
}
export interface ConcreteLiquidTagLayout extends ConcreteLiquidTagNode<NamedTags.layout, ConcreteLiquidExpression> {
}
export interface ConcreteLiquidTagLiquid extends ConcreteLiquidTagNode<NamedTags.liquid, ConcreteLiquidLiquidTagNode[]> {
}
export type ConcreteLiquidLiquidTagNode = ConcreteLiquidTagOpen | ConcreteLiquidTagClose | ConcreteLiquidTag | ConcreteLiquidRawTag;
export interface ConcreteLiquidTagAssign extends ConcreteLiquidTagNode<NamedTags.assign, ConcreteLiquidTagAssignMarkup> {
}
export interface ConcreteLiquidTagAssignMarkup extends ConcreteBasicNode<ConcreteNodeTypes.AssignMarkup> {
    name: string;
    value: ConcreteLiquidVariable;
}
export interface ConcreteLiquidTagCycle extends ConcreteLiquidTagNode<NamedTags.cycle, ConcreteLiquidTagCycleMarkup> {
}
export interface ConcreteLiquidTagCycleMarkup extends ConcreteBasicNode<ConcreteNodeTypes.CycleMarkup> {
    groupName: ConcreteLiquidExpression | null;
    args: ConcreteLiquidExpression[];
}
export interface ConcreteLiquidTagContentFor extends ConcreteLiquidTagNode<NamedTags.content_for, ConcreteLiquidTagContentForMarkup> {
}
export interface ConcreteLiquidTagRender extends ConcreteLiquidTagNode<NamedTags.render, ConcreteLiquidTagRenderMarkup> {
}
export interface ConcreteLiquidTagInclude extends ConcreteLiquidTagNode<NamedTags.include, ConcreteLiquidTagRenderMarkup> {
}
export interface ConcreteLiquidTagContentForMarkup extends ConcreteBasicNode<ConcreteNodeTypes.ContentForMarkup> {
    contentForType: ConcreteStringLiteral;
    args: ConcreteLiquidNamedArgument[];
}
export interface ConcreteLiquidTagRenderMarkup extends ConcreteBasicNode<ConcreteNodeTypes.RenderMarkup> {
    snippet: ConcreteStringLiteral | ConcreteLiquidVariableLookup;
    variable: ConcreteRenderVariableExpression | null;
    alias: ConcreteRenderAliasExpression | null;
    renderArguments: ConcreteLiquidNamedArgument[];
}
export interface ConcreteRenderVariableExpression extends ConcreteBasicNode<ConcreteNodeTypes.RenderVariableExpression> {
    kind: 'for' | 'with';
    name: ConcreteLiquidExpression;
}
export interface ConcreteRenderAliasExpression extends ConcreteBasicNode<ConcreteNodeTypes.RenderAliasExpression> {
    value: string;
}
export interface ConcreteLiquidVariableOutput extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidVariableOutput> {
    markup: ConcreteLiquidVariable | string;
}
export interface ConcreteLiquidVariable extends ConcreteBasicNode<ConcreteNodeTypes.LiquidVariable> {
    expression: ConcreteLiquidExpression;
    filters: ConcreteLiquidFilter[];
    rawSource: string;
}
export interface ConcreteLiquidFilter extends ConcreteBasicNode<ConcreteNodeTypes.LiquidFilter> {
    name: string;
    args: ConcreteLiquidArgument[];
}
export type ConcreteLiquidArgument = ConcreteLiquidExpression | ConcreteLiquidNamedArgument;
export interface ConcreteLiquidNamedArgument extends ConcreteBasicNode<ConcreteNodeTypes.NamedArgument> {
    name: string;
    value: ConcreteLiquidExpression;
}
export type ConcreteLiquidExpression = ConcreteStringLiteral | ConcreteNumberLiteral | ConcreteLiquidLiteral | ConcreteLiquidRange | ConcreteLiquidVariableLookup;
export type ConcreteComplexLiquidExpression = ConcreteLiquidBooleanExpression | ConcreteLiquidExpression;
export interface ConcreteLiquidBooleanExpression extends ConcreteBasicNode<ConcreteNodeTypes.BooleanExpression> {
    conditions: ConcreteLiquidCondition[];
}
export interface ConcreteStringLiteral extends ConcreteBasicNode<ConcreteNodeTypes.String> {
    value: string;
    single: boolean;
}
export interface ConcreteNumberLiteral extends ConcreteBasicNode<ConcreteNodeTypes.Number> {
    value: string;
}
export interface ConcreteLiquidLiteral extends ConcreteBasicNode<ConcreteNodeTypes.LiquidLiteral> {
    keyword: keyof typeof LiquidLiteralValues;
    value: (typeof LiquidLiteralValues)[keyof typeof LiquidLiteralValues];
}
export interface ConcreteLiquidRange extends ConcreteBasicNode<ConcreteNodeTypes.Range> {
    start: ConcreteLiquidExpression;
    end: ConcreteLiquidExpression;
}
export interface ConcreteLiquidVariableLookup extends ConcreteBasicNode<ConcreteNodeTypes.VariableLookup> {
    name: string | null;
    lookups: ConcreteLiquidExpression[];
}
export type ConcreteHtmlNode = ConcreteHtmlDoctype | ConcreteHtmlComment | ConcreteHtmlRawTag | ConcreteHtmlVoidElement | ConcreteHtmlSelfClosingElement | ConcreteHtmlTagOpen | ConcreteHtmlTagClose;
export interface ConcreteTextNode extends ConcreteBasicNode<ConcreteNodeTypes.TextNode> {
    value: string;
}
export interface ConcreteYamlFrontmatterNode extends ConcreteBasicNode<ConcreteNodeTypes.YAMLFrontmatter> {
    body: string;
}
export type LiquidHtmlConcreteNode = ConcreteHtmlNode | ConcreteYamlFrontmatterNode | LiquidConcreteNode;
export type LiquidConcreteNode = ConcreteLiquidNode | ConcreteTextNode | ConcreteYamlFrontmatterNode | LiquidDocConcreteNode;
export type LiquidHtmlCST = LiquidHtmlConcreteNode[];
export type LiquidCST = LiquidConcreteNode[];
export type LiquidDocConcreteNode = ConcreteLiquidDocParamNode | ConcreteLiquidDocExampleNode | ConcreteLiquidDocDescriptionNode | ConcreteLiquidDocPromptNode;
export interface CSTBuildOptions {
    /**
     * 'strict' will disable the Liquid parsing base cases. Which means that we will
     * throw an error if we can't parse the node `markup` properly.
     *
     * 'tolerant' is the default case so that prettier can pretty print nodes
     * that it doesn't understand.
     */
    mode: 'strict' | 'tolerant' | 'completion';
}
export declare function toLiquidHtmlCST(source: string, options?: CSTBuildOptions): LiquidHtmlCST;
export declare function toLiquidCST(source: string, options?: CSTBuildOptions): LiquidCST;
export {};
