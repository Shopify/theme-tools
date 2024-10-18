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
import ohm, { Node } from 'ohm-js';
import { toAST } from 'ohm-js/extras';
import {
  LiquidGrammars,
  TextNodeGrammar,
  placeholderGrammars,
  strictGrammars,
  tolerantGrammars,
} from './grammar';
import { LiquidHTMLCSTParsingError } from './errors';
import { Comparators, NamedTags } from './types';

export enum ConcreteNodeTypes {
  HtmlDoctype = 'HtmlDoctype',
  HtmlComment = 'HtmlComment',
  HtmlRawTag = 'HtmlRawTag',
  HtmlVoidElement = 'HtmlVoidElement',
  HtmlSelfClosingElement = 'HtmlSelfClosingElement',
  HtmlTagOpen = 'HtmlTagOpen',
  HtmlTagClose = 'HtmlTagClose',
  AttrSingleQuoted = 'AttrSingleQuoted',
  AttrDoubleQuoted = 'AttrDoubleQuoted',
  AttrUnquoted = 'AttrUnquoted',
  AttrEmpty = 'AttrEmpty',
  LiquidVariableOutput = 'LiquidVariableOutput',
  LiquidRawTag = 'LiquidRawTag',
  LiquidTag = 'LiquidTag',
  LiquidTagOpen = 'LiquidTagOpen',
  LiquidTagClose = 'LiquidTagClose',
  TextNode = 'TextNode',
  YAMLFrontmatter = 'YAMLFrontmatter',

  LiquidVariable = 'LiquidVariable',
  LiquidFilter = 'LiquidFilter',
  NamedArgument = 'NamedArgument',
  LiquidLiteral = 'LiquidLiteral',
  VariableLookup = 'VariableLookup',
  String = 'String',
  Number = 'Number',
  Range = 'Range',
  Comparison = 'Comparison',
  Condition = 'Condition',

  AssignMarkup = 'AssignMarkup',
  CycleMarkup = 'CycleMarkup',
  ForMarkup = 'ForMarkup',
  RenderMarkup = 'RenderMarkup',
  PaginateMarkup = 'PaginateMarkup',
  RenderVariableExpression = 'RenderVariableExpression',
}

export const LiquidLiteralValues = {
  nil: null,
  null: null,
  true: true as true,
  false: false as false,
  blank: '' as '',
  empty: '' as '',
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
export interface ConcreteHtmlVoidElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlVoidElement> {
  name: string;
}
export interface ConcreteHtmlSelfClosingElement
  extends ConcreteHtmlNodeBase<ConcreteNodeTypes.HtmlSelfClosingElement> {
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

export type ConcreteAttributeNode =
  | ConcreteLiquidNode
  | ConcreteAttrSingleQuoted
  | ConcreteAttrDoubleQuoted
  | ConcreteAttrUnquoted
  | ConcreteAttrEmpty;

export interface ConcreteAttrSingleQuoted
  extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrSingleQuoted> {}
export interface ConcreteAttrDoubleQuoted
  extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrDoubleQuoted> {}
export interface ConcreteAttrUnquoted
  extends ConcreteAttributeNodeBase<ConcreteNodeTypes.AttrUnquoted> {}
export interface ConcreteAttrEmpty extends ConcreteBasicNode<ConcreteNodeTypes.AttrEmpty> {
  name: (ConcreteLiquidVariableOutput | ConcreteTextNode)[];
}

export type ConcreteLiquidNode =
  | ConcreteLiquidRawTag
  | ConcreteLiquidTagOpen
  | ConcreteLiquidTagClose
  | ConcreteLiquidTag
  | ConcreteLiquidVariableOutput;

interface ConcreteBasicLiquidNode<T> extends ConcreteBasicNode<T> {
  whitespaceStart: null | '-';
  whitespaceEnd: null | '-';
}

export interface ConcreteLiquidRawTag
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidRawTag> {
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
export type ConcreteLiquidTagOpenNamed =
  | ConcreteLiquidTagOpenCase
  | ConcreteLiquidTagOpenCapture
  | ConcreteLiquidTagOpenIf
  | ConcreteLiquidTagOpenUnless
  | ConcreteLiquidTagOpenForm
  | ConcreteLiquidTagOpenFor
  | ConcreteLiquidTagOpenPaginate
  | ConcreteLiquidTagOpenTablerow;

export interface ConcreteLiquidTagOpenNode<Name, Markup>
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagOpen> {
  name: Name;
  markup: Markup;
}

export interface ConcreteLiquidTagOpenBaseCase extends ConcreteLiquidTagOpenNode<string, string> {}

export interface ConcreteLiquidTagOpenCapture
  extends ConcreteLiquidTagOpenNode<NamedTags.capture, ConcreteLiquidVariableLookup> {}

export interface ConcreteLiquidTagOpenCase
  extends ConcreteLiquidTagOpenNode<NamedTags.case, ConcreteLiquidExpression> {}
export interface ConcreteLiquidTagWhen
  extends ConcreteLiquidTagNode<NamedTags.when, ConcreteLiquidExpression[]> {}

export interface ConcreteLiquidTagOpenIf
  extends ConcreteLiquidTagOpenNode<NamedTags.if, ConcreteLiquidCondition[]> {}
export interface ConcreteLiquidTagOpenUnless
  extends ConcreteLiquidTagOpenNode<NamedTags.unless, ConcreteLiquidCondition[]> {}
export interface ConcreteLiquidTagElsif
  extends ConcreteLiquidTagNode<NamedTags.elsif, ConcreteLiquidCondition[]> {}

export interface ConcreteLiquidCondition extends ConcreteBasicNode<ConcreteNodeTypes.Condition> {
  relation: 'and' | 'or' | null;
  expression: ConcreteLiquidComparison | ConcreteLiquidExpression;
}

export interface ConcreteLiquidComparison extends ConcreteBasicNode<ConcreteNodeTypes.Comparison> {
  comparator: Comparators;
  left: ConcreteLiquidExpression;
  right: ConcreteLiquidExpression;
}

export interface ConcreteLiquidTagOpenForm
  extends ConcreteLiquidTagOpenNode<NamedTags.form, ConcreteLiquidArgument[]> {}

export interface ConcreteLiquidTagOpenFor
  extends ConcreteLiquidTagOpenNode<NamedTags.for, ConcreteLiquidTagForMarkup> {}
export interface ConcreteLiquidTagForMarkup extends ConcreteBasicNode<ConcreteNodeTypes.ForMarkup> {
  variableName: string;
  collection: ConcreteLiquidExpression;
  reversed: 'reversed' | null;
  args: ConcreteLiquidNamedArgument[];
}

export interface ConcreteLiquidTagOpenTablerow
  extends ConcreteLiquidTagOpenNode<NamedTags.tablerow, ConcreteLiquidTagForMarkup> {}

export interface ConcreteLiquidTagOpenPaginate
  extends ConcreteLiquidTagOpenNode<NamedTags.paginate, ConcretePaginateMarkup> {}

export interface ConcretePaginateMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.PaginateMarkup> {
  collection: ConcreteLiquidExpression;
  pageSize: ConcreteLiquidExpression;
  args: ConcreteLiquidNamedArgument[] | null;
}

export interface ConcreteLiquidTagClose
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTagClose> {
  name: string;
}

export type ConcreteLiquidTag = ConcreteLiquidTagNamed | ConcreteLiquidTagBaseCase;
export type ConcreteLiquidTagNamed =
  | ConcreteLiquidTagAssign
  | ConcreteLiquidTagCycle
  | ConcreteLiquidTagEcho
  | ConcreteLiquidTagIncrement
  | ConcreteLiquidTagDecrement
  | ConcreteLiquidTagElsif
  | ConcreteLiquidTagInclude
  | ConcreteLiquidTagLayout
  | ConcreteLiquidTagLiquid
  | ConcreteLiquidTagRender
  | ConcreteLiquidTagSection
  | ConcreteLiquidTagSections
  | ConcreteLiquidTagWhen;

export interface ConcreteLiquidTagNode<Name, Markup>
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidTag> {
  markup: Markup;
  name: Name;
}

export interface ConcreteLiquidTagBaseCase extends ConcreteLiquidTagNode<string, string> {}
export interface ConcreteLiquidTagEcho
  extends ConcreteLiquidTagNode<NamedTags.echo, ConcreteLiquidVariable> {}
export interface ConcreteLiquidTagIncrement
  extends ConcreteLiquidTagNode<NamedTags.increment, ConcreteLiquidVariableLookup> {}
export interface ConcreteLiquidTagDecrement
  extends ConcreteLiquidTagNode<NamedTags.decrement, ConcreteLiquidVariableLookup> {}
export interface ConcreteLiquidTagSection
  extends ConcreteLiquidTagNode<NamedTags.section, ConcreteStringLiteral> {}
export interface ConcreteLiquidTagSections
  extends ConcreteLiquidTagNode<NamedTags.sections, ConcreteStringLiteral> {}
export interface ConcreteLiquidTagLayout
  extends ConcreteLiquidTagNode<NamedTags.layout, ConcreteLiquidExpression> {}

export interface ConcreteLiquidTagLiquid
  extends ConcreteLiquidTagNode<NamedTags.liquid, ConcreteLiquidLiquidTagNode[]> {}
export type ConcreteLiquidLiquidTagNode =
  | ConcreteLiquidTagOpen
  | ConcreteLiquidTagClose
  | ConcreteLiquidTag
  | ConcreteLiquidRawTag;

export interface ConcreteLiquidTagAssign
  extends ConcreteLiquidTagNode<NamedTags.assign, ConcreteLiquidTagAssignMarkup> {}
export interface ConcreteLiquidTagAssignMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.AssignMarkup> {
  name: string;
  value: ConcreteLiquidVariable;
}

export interface ConcreteLiquidTagCycle
  extends ConcreteLiquidTagNode<NamedTags.cycle, ConcreteLiquidTagCycleMarkup> {}
export interface ConcreteLiquidTagCycleMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.CycleMarkup> {
  groupName: ConcreteLiquidExpression | null;
  args: ConcreteLiquidExpression[];
}

export interface ConcreteLiquidTagRender
  extends ConcreteLiquidTagNode<NamedTags.render, ConcreteLiquidTagRenderMarkup> {}
export interface ConcreteLiquidTagInclude
  extends ConcreteLiquidTagNode<NamedTags.include, ConcreteLiquidTagRenderMarkup> {}

export interface ConcreteLiquidTagRenderMarkup
  extends ConcreteBasicNode<ConcreteNodeTypes.RenderMarkup> {
  snippet: ConcreteStringLiteral | ConcreteLiquidVariableLookup;
  alias: string | null;
  variable: ConcreteRenderVariableExpression | null;
  args: ConcreteLiquidNamedArgument[];
}

export interface ConcreteRenderVariableExpression
  extends ConcreteBasicNode<ConcreteNodeTypes.RenderVariableExpression> {
  kind: 'for' | 'with';
  name: ConcreteLiquidExpression;
}

export interface ConcreteLiquidVariableOutput
  extends ConcreteBasicLiquidNode<ConcreteNodeTypes.LiquidVariableOutput> {
  markup: ConcreteLiquidVariable | string;
}

// The variable is the name + filters, like shopify/liquid.
export interface ConcreteLiquidVariable
  extends ConcreteBasicNode<ConcreteNodeTypes.LiquidVariable> {
  expression: ConcreteLiquidExpression;
  filters: ConcreteLiquidFilter[];
  rawSource: string;
}

export interface ConcreteLiquidFilter extends ConcreteBasicNode<ConcreteNodeTypes.LiquidFilter> {
  name: string;
  args: ConcreteLiquidArgument[];
}

export type ConcreteLiquidArgument = ConcreteLiquidExpression | ConcreteLiquidNamedArgument;

export interface ConcreteLiquidNamedArgument
  extends ConcreteBasicNode<ConcreteNodeTypes.NamedArgument> {
  name: string;
  value: ConcreteLiquidExpression;
}

export type ConcreteLiquidExpression =
  | ConcreteStringLiteral
  | ConcreteNumberLiteral
  | ConcreteLiquidLiteral
  | ConcreteLiquidRange
  | ConcreteLiquidVariableLookup;

export interface ConcreteStringLiteral extends ConcreteBasicNode<ConcreteNodeTypes.String> {
  value: string;
  single: boolean;
}

export interface ConcreteNumberLiteral extends ConcreteBasicNode<ConcreteNodeTypes.Number> {
  value: string; // float parsing is weird but supported
}

export interface ConcreteLiquidLiteral extends ConcreteBasicNode<ConcreteNodeTypes.LiquidLiteral> {
  keyword: keyof typeof LiquidLiteralValues;
  value: (typeof LiquidLiteralValues)[keyof typeof LiquidLiteralValues];
}

export interface ConcreteLiquidRange extends ConcreteBasicNode<ConcreteNodeTypes.Range> {
  start: ConcreteLiquidExpression;
  end: ConcreteLiquidExpression;
}

export interface ConcreteLiquidVariableLookup
  extends ConcreteBasicNode<ConcreteNodeTypes.VariableLookup> {
  name: string | null;
  lookups: ConcreteLiquidExpression[];
}

export type ConcreteHtmlNode =
  | ConcreteHtmlDoctype
  | ConcreteHtmlComment
  | ConcreteHtmlRawTag
  | ConcreteHtmlVoidElement
  | ConcreteHtmlSelfClosingElement
  | ConcreteHtmlTagOpen
  | ConcreteHtmlTagClose;

export interface ConcreteTextNode extends ConcreteBasicNode<ConcreteNodeTypes.TextNode> {
  value: string;
}

export interface ConcreteYamlFrontmatterNode
  extends ConcreteBasicNode<ConcreteNodeTypes.YAMLFrontmatter> {
  body: string;
}

export type LiquidHtmlConcreteNode =
  | ConcreteHtmlNode
  | ConcreteLiquidNode
  | ConcreteTextNode
  | ConcreteYamlFrontmatterNode;

export type LiquidConcreteNode =
  | ConcreteLiquidNode
  | ConcreteTextNode
  | ConcreteYamlFrontmatterNode;

export type LiquidHtmlCST = LiquidHtmlConcreteNode[];

export type LiquidCST = LiquidConcreteNode[];

interface Mapping {
  [k: string]: number | TemplateMapping | TopLevelFunctionMapping;
}

interface TemplateMapping {
  type: ConcreteNodeTypes;
  locStart: (node: Node[]) => number;
  locEnd: (node: Node[]) => number;
  source: string;
  [k: string]: FunctionMapping | string | number | boolean | object | null;
}

type TopLevelFunctionMapping = (...nodes: Node[]) => any;
type FunctionMapping = (nodes: Node[]) => any;

const markup = (i: number) => (tokens: Node[]) => tokens[i].sourceString.trim();
const markupTrimEnd = (i: number) => (tokens: Node[]) => tokens[i].sourceString.trimEnd();

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

const Grammars: Record<CSTBuildOptions['mode'], LiquidGrammars> = {
  strict: strictGrammars,
  tolerant: tolerantGrammars,
  completion: placeholderGrammars,
};

export function toLiquidHtmlCST(
  source: string,
  options: CSTBuildOptions = { mode: 'tolerant' },
): LiquidHtmlCST {
  const grammars = Grammars[options.mode];
  const grammar = grammars.LiquidHTML;
  return toCST(source, grammars, grammar, [
    'HelperMappings',
    'LiquidMappings',
    'LiquidHTMLMappings',
  ]);
}

export function toLiquidCST(
  source: string,
  options: CSTBuildOptions = { mode: 'tolerant' },
): LiquidCST {
  const grammars = Grammars[options.mode];
  const grammar = grammars.Liquid;
  return toCST(source, grammars, grammar, ['HelperMappings', 'LiquidMappings']);
}

function toCST<T>(
  source: string /* the original file */,
  grammars: LiquidGrammars,
  grammar: ohm.Grammar,
  cstMappings: ('HelperMappings' | 'LiquidMappings' | 'LiquidHTMLMappings' | 'LiquidStatement')[],
  matchingSource: string = source /* for subtree parsing */,
  offset: number = 0 /* for subtree parsing location offsets */,
): T {
  // When we switch parser, our locStart and locEnd functions must account
  // for the offset of the {% liquid %} markup
  const locStart = (tokens: Node[]) => offset + tokens[0].source.startIdx;
  const locEnd = (tokens: Node[]) => offset + tokens[tokens.length - 1].source.endIdx;
  const locEndSecondToLast = (tokens: Node[]) => offset + tokens[tokens.length - 2].source.endIdx;

  const textNode = {
    type: ConcreteNodeTypes.TextNode,
    value: function () {
      return (this as any).sourceString;
    },
    locStart,
    locEnd,
    source,
  };

  const res = grammar.match(matchingSource, 'Node');
  if (res.failed()) {
    throw new LiquidHTMLCSTParsingError(res);
  }

  const HelperMappings: Mapping = {
    Node: 0,
    TextNode: textNode,
    orderedListOf: 0,

    listOf: 0,
    empty: () => null,
    emptyListOf: () => [],
    nonemptyListOf(first: any, _sep: any, rest: any) {
      const self = this as any;
      return [first.toAST(self.args.mapping)].concat(rest.toAST(self.args.mapping));
    },

    nonemptyOrderedListOf: 0,
    nonemptyOrderedListOfBoth(nonemptyListOfA: Node, _sep: Node, nonemptyListOfB: Node) {
      const self = this as any;
      return nonemptyListOfA
        .toAST(self.args.mapping)
        .concat(nonemptyListOfB.toAST(self.args.mapping));
    },
  };

  const LiquidMappings: Mapping = {
    liquidNode: 0,
    liquidRawTag: 0,
    liquidRawTagImpl: {
      type: ConcreteNodeTypes.LiquidRawTag,
      name: 3,
      body: 9,
      children: (tokens: Node[]) => {
        const nameNode = tokens[3];
        const rawMarkupStringNode = tokens[9];
        switch (nameNode.sourceString) {
          // {% raw %} accepts syntax errors, we shouldn't try to parse that
          case 'raw': {
            return toCST(
              source,
              grammars,
              TextNodeGrammar,
              ['HelperMappings'],
              rawMarkupStringNode.sourceString,
              offset + rawMarkupStringNode.source.startIdx,
            );
          }

          // {% javascript %}, {% style %}
          default: {
            return toCST(
              source,
              grammars,
              grammars.Liquid,
              ['HelperMappings', 'LiquidMappings'],
              rawMarkupStringNode.sourceString,
              offset + rawMarkupStringNode.source.startIdx,
            );
          }
        }
      },
      markup: 6,
      whitespaceStart: 1,
      whitespaceEnd: 7,
      delimiterWhitespaceStart: 11,
      delimiterWhitespaceEnd: 17,
      locStart,
      locEnd,
      source,
      blockStartLocStart: (tokens: Node[]) => tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: Node[]) => tokens[8].source.endIdx,
      blockEndLocStart: (tokens: Node[]) => tokens[10].source.startIdx,
      blockEndLocEnd: (tokens: Node[]) => tokens[18].source.endIdx,
    },
    liquidBlockComment: {
      type: ConcreteNodeTypes.LiquidRawTag,
      name: 'comment',
      body: (tokens: Node[]) => tokens[1].sourceString,
      children: (tokens: Node[]) => {
        return toCST(
          source,
          grammars,
          TextNodeGrammar,
          ['HelperMappings'],
          tokens[1].sourceString,
          offset + tokens[1].source.startIdx,
        );
      },
      whitespaceStart: (tokens: Node[]) => tokens[0].children[1].sourceString,
      whitespaceEnd: (tokens: Node[]) => tokens[0].children[7].sourceString,
      delimiterWhitespaceStart: (tokens: Node[]) => tokens[2].children[1].sourceString,
      delimiterWhitespaceEnd: (tokens: Node[]) => tokens[2].children[7].sourceString,
      locStart,
      locEnd,
      source,
      blockStartLocStart: (tokens: Node[]) => tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: Node[]) => tokens[0].source.endIdx,
      blockEndLocStart: (tokens: Node[]) => tokens[2].source.startIdx,
      blockEndLocEnd: (tokens: Node[]) => tokens[2].source.endIdx,
    },
    liquidInlineComment: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 3,
      markup: markupTrimEnd(5),
      whitespaceStart: 1,
      whitespaceEnd: 6,
      locStart,
      locEnd,
      source,
    },

    liquidTagOpen: 0,
    liquidTagOpenStrict: 0,
    liquidTagOpenBaseCase: 0,
    liquidTagOpenRule: {
      type: ConcreteNodeTypes.LiquidTagOpen,
      name: 3,
      markup(nodes: Node[]) {
        const markupNode = nodes[6];
        const nameNode = nodes[3];
        if (NamedTags.hasOwnProperty(nameNode.sourceString)) {
          return markupNode.toAST((this as any).args.mapping);
        }
        return markupNode.sourceString.trim();
      },
      whitespaceStart: 1,
      whitespaceEnd: 7,
      locStart,
      locEnd,
      source,
    },

    liquidTagOpenCapture: 0,
    liquidTagOpenForm: 0,
    liquidTagOpenFormMarkup: 0,
    liquidTagOpenFor: 0,
    liquidTagOpenForMarkup: {
      type: ConcreteNodeTypes.ForMarkup,
      variableName: 0,
      collection: 4,
      reversed: 6,
      args: 8,
      locStart,
      locEnd,
      source,
    },
    liquidTagBreak: 0,
    liquidTagContinue: 0,
    liquidTagOpenTablerow: 0,
    liquidTagOpenPaginate: 0,
    liquidTagOpenPaginateMarkup: {
      type: ConcreteNodeTypes.PaginateMarkup,
      collection: 0,
      pageSize: 4,
      args: 6,
      locStart,
      locEnd,
      source,
    },
    liquidTagOpenCase: 0,
    liquidTagOpenCaseMarkup: 0,
    liquidTagWhen: 0,
    liquidTagWhenMarkup: 0,
    liquidTagOpenIf: 0,
    liquidTagOpenUnless: 0,
    liquidTagElsif: 0,
    liquidTagElse: 0,
    liquidTagOpenConditionalMarkup: 0,
    condition: {
      type: ConcreteNodeTypes.Condition,
      relation: 0,
      expression: 2,
      locStart,
      locEnd,
      source,
    },
    comparison: {
      type: ConcreteNodeTypes.Comparison,
      comparator: 2,
      left: 0,
      right: 4,
      locStart,
      locEnd,
      source,
    },

    liquidTagClose: {
      type: ConcreteNodeTypes.LiquidTagClose,
      name: 4,
      whitespaceStart: 1,
      whitespaceEnd: 7,
      locStart,
      locEnd,
      source,
    },

    liquidTag: 0,
    liquidTagStrict: 0,
    liquidTagBaseCase: 0,
    liquidTagAssign: 0,
    liquidTagEcho: 0,
    liquidTagCycle: 0,
    liquidTagIncrement: 0,
    liquidTagDecrement: 0,
    liquidTagRender: 0,
    liquidTagInclude: 0,
    liquidTagSection: 0,
    liquidTagSections: 0,
    liquidTagLayout: 0,
    liquidTagRule: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 3,
      markup(nodes: Node[]) {
        const markupNode = nodes[6];
        const nameNode = nodes[3];
        if (NamedTags.hasOwnProperty(nameNode.sourceString)) {
          return markupNode.toAST((this as any).args.mapping);
        }
        return markupNode.sourceString.trim();
      },
      whitespaceStart: 1,
      whitespaceEnd: 7,
      source,
      locStart,
      locEnd,
    },

    liquidTagLiquid: 0,
    liquidTagLiquidMarkup(tagMarkup: Node) {
      return toCST(
        source,
        grammars,
        grammars.LiquidStatement,
        ['HelperMappings', 'LiquidMappings', 'LiquidStatement'],
        tagMarkup.sourceString,
        offset + tagMarkup.source.startIdx,
      );
    },

    liquidTagEchoMarkup: 0,
    liquidTagSectionMarkup: 0,
    liquidTagSectionsMarkup: 0,
    liquidTagLayoutMarkup: 0,
    liquidTagAssignMarkup: {
      type: ConcreteNodeTypes.AssignMarkup,
      name: 0,
      value: 4,
      locStart,
      locEnd,
      source,
    },

    liquidTagCycleMarkup: {
      type: ConcreteNodeTypes.CycleMarkup,
      groupName: 0,
      args: 3,
      locStart,
      locEnd,
      source,
    },

    liquidTagRenderMarkup: {
      type: ConcreteNodeTypes.RenderMarkup,
      snippet: 0,
      variable: 1,
      alias: 2,
      args: 4,
      locStart,
      locEnd,
      source,
    },
    snippetExpression: 0,
    renderVariableExpression: {
      type: ConcreteNodeTypes.RenderVariableExpression,
      kind: 1,
      name: 3,
      locStart,
      locEnd,
      source,
    },
    renderAliasExpression: 3,

    liquidDrop: {
      type: ConcreteNodeTypes.LiquidVariableOutput,
      markup: 3,
      whitespaceStart: 1,
      whitespaceEnd: 4,
      locStart,
      locEnd,
      source,
    },

    liquidDropCases: 0,
    liquidExpression: 0,
    liquidDropBaseCase: (sw: Node) => sw.sourceString.trimEnd(),
    liquidVariable: {
      type: ConcreteNodeTypes.LiquidVariable,
      expression: 0,
      filters: 1,
      rawSource: (tokens: Node[]) =>
        source.slice(locStart(tokens), tokens[tokens.length - 2].source.endIdx).trimEnd(),
      locStart,
      // The last node of this rule is a positive lookahead, we don't
      // want its endIdx, we want the endIdx of the previous one.
      locEnd: locEndSecondToLast,
      source,
    },

    liquidFilter: {
      type: ConcreteNodeTypes.LiquidFilter,
      name: 3,
      locStart,
      locEnd,
      source,
      args(nodes: Node[]) {
        // Traditinally, this would get transformed into null or array. But
        // it's better if we have an empty array instead of null here.
        if (nodes[7].sourceString === '') {
          return [];
        } else {
          return nodes[7].toAST((this as any).args.mapping);
        }
      },
    },
    filterArguments: 0,
    arguments: 0,
    complexArguments: function (completeParams, _space1, _comma, _space2, incompleteParam) {
      const self = this as any;

      return completeParams
        .toAST(self.args.mapping)
        .concat(
          incompleteParam.sourceString === '' ? [] : incompleteParam.toAST(self.args.mapping),
        );
    },
    simpleArgument: 0,
    tagArguments: 0,
    positionalArgument: 0,
    namedArgument: {
      type: ConcreteNodeTypes.NamedArgument,
      name: 0,
      value: 4,
      locStart,
      locEnd,
      source,
    },

    liquidString: 0,
    liquidDoubleQuotedString: {
      type: ConcreteNodeTypes.String,
      single: () => false,
      value: 1,
      locStart,
      locEnd,
      source,
    },
    liquidSingleQuotedString: {
      type: ConcreteNodeTypes.String,
      single: () => true,
      value: 1,
      locStart,
      locEnd,
      source,
    },

    liquidNumber: {
      type: ConcreteNodeTypes.Number,
      value: 0,
      locStart,
      locEnd,
      source,
    },

    liquidLiteral: {
      type: ConcreteNodeTypes.LiquidLiteral,
      value: (tokens: Node[]) => {
        const keyword = tokens[0].sourceString as keyof typeof LiquidLiteralValues;
        return LiquidLiteralValues[keyword];
      },
      keyword: 0,
      locStart,
      locEnd,
      source,
    },

    liquidRange: {
      type: ConcreteNodeTypes.Range,
      start: 2,
      end: 6,
      locStart,
      locEnd,
      source,
    },

    liquidVariableLookup: {
      type: ConcreteNodeTypes.VariableLookup,
      name: 0,
      lookups: 1,
      locStart,
      locEnd,
      source,
    },
    variableSegmentAsLookupMarkup: 0,
    variableSegmentAsLookup: {
      type: ConcreteNodeTypes.VariableLookup,
      name: 0,
      lookups: () => [],
      locStart,
      locEnd,
      source,
    },

    lookup: 0,
    indexLookup: 3,
    dotLookup: {
      type: ConcreteNodeTypes.String,
      value: 3,
      locStart: (nodes: Node[]) => offset + nodes[2].source.startIdx,
      locEnd: (nodes: Node[]) => offset + nodes[nodes.length - 1].source.endIdx,
      source,
    },

    // trim on both sides
    tagMarkup: (n: Node) => n.sourceString.trim(),
  };

  const LiquidStatement: Mapping = {
    LiquidStatement: 0,
    liquidTagOpenRule: {
      type: ConcreteNodeTypes.LiquidTagOpen,
      name: 0,
      markup(nodes: Node[]) {
        const markupNode = nodes[2];
        const nameNode = nodes[0];
        if (NamedTags.hasOwnProperty(nameNode.sourceString)) {
          return markupNode.toAST((this as any).args.mapping);
        }
        return markupNode.sourceString.trim();
      },
      whitespaceStart: null,
      whitespaceEnd: null,
      locStart,
      locEnd: locEndSecondToLast,
      source,
    },

    liquidTagClose: {
      type: ConcreteNodeTypes.LiquidTagClose,
      name: 1,
      whitespaceStart: null,
      whitespaceEnd: null,
      locStart,
      locEnd: locEndSecondToLast,
      source,
    },

    liquidTagRule: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 0,
      markup(nodes: Node[]) {
        const markupNode = nodes[2];
        const nameNode = nodes[0];
        if (NamedTags.hasOwnProperty(nameNode.sourceString)) {
          return markupNode.toAST((this as any).args.mapping);
        }
        return markupNode.sourceString.trim();
      },
      whitespaceStart: null,
      whitespaceEnd: null,
      locStart,
      locEnd: locEndSecondToLast,
      source,
    },

    liquidRawTagImpl: {
      type: ConcreteNodeTypes.LiquidRawTag,
      name: 0,
      body: 4,
      children(nodes) {
        return toCST(
          source,
          grammars,
          TextNodeGrammar,
          ['HelperMappings'],
          nodes[4].sourceString,
          offset + nodes[4].source.startIdx,
        );
      },
      whitespaceStart: null,
      whitespaceEnd: null,
      delimiterWhitespaceStart: null,
      delimiterWhitespaceEnd: null,
      locStart,
      locEnd: locEndSecondToLast,
      source,
      blockStartLocStart: (tokens: Node[]) => offset + tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: Node[]) => offset + tokens[2].source.endIdx,
      blockEndLocStart: (tokens: Node[]) => offset + tokens[5].source.startIdx,
      blockEndLocEnd: (tokens: Node[]) => offset + tokens[5].source.endIdx,
    },

    liquidBlockComment: {
      type: ConcreteNodeTypes.LiquidRawTag,
      name: 'comment',
      body: (tokens: Node[]) =>
        // We want this to behave like LiquidRawTag, so we have to do some
        // shenanigans to make it behave the same while also supporting
        // nested comments
        //
        // We're stripping the newline from the statementSep, that's why we
        // slice(1). Since statementSep = newline (space | newline)*
        tokens[1].sourceString.slice(1) + tokens[2].sourceString,
      children(tokens) {
        const commentSource = tokens[1].sourceString.slice(1) + tokens[2].sourceString;
        return toCST(
          source,
          grammars,
          TextNodeGrammar,
          ['HelperMappings'],
          commentSource,
          offset + tokens[1].source.startIdx + 1,
        );
      },
      whitespaceStart: '',
      whitespaceEnd: '',
      delimiterWhitespaceStart: '',
      delimiterWhitespaceEnd: '',
      locStart,
      locEnd,
      source,
      blockStartLocStart: (tokens: Node[]) => offset + tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: Node[]) => offset + tokens[0].source.endIdx,
      blockEndLocStart: (tokens: Node[]) => offset + tokens[4].source.startIdx,
      blockEndLocEnd: (tokens: Node[]) => offset + tokens[4].source.endIdx,
    },

    liquidInlineComment: {
      type: ConcreteNodeTypes.LiquidTag,
      name: 0,
      markup: markupTrimEnd(2),
      whitespaceStart: null,
      whitespaceEnd: null,
      locStart,
      locEnd: locEndSecondToLast,
      source,
    },
  };

  const LiquidHTMLMappings: Mapping = {
    Node(frontmatter: Node, nodes: Node) {
      const self = this as any;
      const frontmatterNode =
        frontmatter.sourceString.length === 0 ? [] : [frontmatter.toAST(self.args.mapping)];

      return frontmatterNode.concat(nodes.toAST(self.args.mapping));
    },

    yamlFrontmatter: {
      type: ConcreteNodeTypes.YAMLFrontmatter,
      body: 2,
      locStart,
      locEnd,
      source,
    },

    HtmlDoctype: {
      type: ConcreteNodeTypes.HtmlDoctype,
      legacyDoctypeString: 4,
      locStart,
      locEnd,
      source,
    },

    HtmlComment: {
      type: ConcreteNodeTypes.HtmlComment,
      body: markup(1),
      locStart,
      locEnd,
      source,
    },

    HtmlRawTagImpl: {
      type: ConcreteNodeTypes.HtmlRawTag,
      name: (tokens: Node[]) => tokens[0].children[1].sourceString,
      attrList(tokens: Node[]) {
        const mappings = (this as any).args.mapping;
        return tokens[0].children[2].toAST(mappings);
      },
      body: (tokens: Node[]) => source.slice(tokens[0].source.endIdx, tokens[2].source.startIdx),
      children: (tokens: Node[]) => {
        const rawMarkup = source.slice(tokens[0].source.endIdx, tokens[2].source.startIdx);
        return toCST(
          source,
          grammars,
          grammars.Liquid,
          ['HelperMappings', 'LiquidMappings'],
          rawMarkup,
          tokens[0].source.endIdx,
        );
      },
      locStart,
      locEnd,
      source,
      blockStartLocStart: (tokens: any) => tokens[0].source.startIdx,
      blockStartLocEnd: (tokens: any) => tokens[0].source.endIdx,
      blockEndLocStart: (tokens: any) => tokens[2].source.startIdx,
      blockEndLocEnd: (tokens: any) => tokens[2].source.endIdx,
    },

    HtmlVoidElement: {
      type: ConcreteNodeTypes.HtmlVoidElement,
      name: 1,
      attrList: 3,
      locStart,
      locEnd,
      source,
    },

    HtmlSelfClosingElement: {
      type: ConcreteNodeTypes.HtmlSelfClosingElement,
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
      source,
    },

    HtmlTagOpen: {
      type: ConcreteNodeTypes.HtmlTagOpen,
      name: 1,
      attrList: 2,
      locStart,
      locEnd,
      source,
    },

    HtmlTagClose: {
      type: ConcreteNodeTypes.HtmlTagClose,
      name: 1,
      locStart,
      locEnd,
      source,
    },

    leadingTagNamePart: 0,
    leadingTagNameTextNode: textNode,
    trailingTagNamePart: 0,
    trailingTagNameTextNode: textNode,
    tagName(leadingPart: Node, trailingParts: Node) {
      const mappings = (this as any).args.mapping;
      return [leadingPart.toAST(mappings)].concat(trailingParts.toAST(mappings));
    },

    AttrUnquoted: {
      type: ConcreteNodeTypes.AttrUnquoted,
      name: 0,
      value: 2,
      locStart,
      locEnd,
      source,
    },

    AttrSingleQuoted: {
      type: ConcreteNodeTypes.AttrSingleQuoted,
      name: 0,
      value: 3,
      locStart,
      locEnd,
      source,
    },

    AttrDoubleQuoted: {
      type: ConcreteNodeTypes.AttrDoubleQuoted,
      name: 0,
      value: 3,
      locStart,
      locEnd,
      source,
    },

    attrEmpty: {
      type: ConcreteNodeTypes.AttrEmpty,
      name: 0,
      locStart,
      locEnd,
      source,
    },

    attrName: 0,
    attrNameTextNode: textNode,
    attrDoubleQuotedValue: 0,
    attrSingleQuotedValue: 0,
    attrUnquotedValue: 0,
    attrDoubleQuotedTextNode: textNode,
    attrSingleQuotedTextNode: textNode,
    attrUnquotedTextNode: textNode,
  };

  const defaultMappings = {
    HelperMappings,
    LiquidMappings,
    LiquidHTMLMappings,
    LiquidStatement,
  };

  const selectedMappings = cstMappings.reduce(
    (mappings, key) => ({
      ...mappings,
      ...defaultMappings[key],
    }),
    {},
  );

  return toAST(res, selectedMappings) as T;
}
