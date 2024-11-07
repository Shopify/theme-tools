export interface Position {
  /** 0-indexed offset in the string, included */
  start: number;
  /** 0-indexed offset, excluded */
  end: number;
}

export enum NodeTypes {
  Document = 'Document',
  LiquidRawTag = 'LiquidRawTag',
  LiquidTag = 'LiquidTag',
  LiquidBranch = 'LiquidBranch',
  LiquidVariableOutput = 'LiquidVariableOutput',
  HtmlSelfClosingElement = 'HtmlSelfClosingElement',
  HtmlVoidElement = 'HtmlVoidElement',
  HtmlDoctype = 'HtmlDoctype',
  HtmlComment = 'HtmlComment',
  HtmlElement = 'HtmlElement',
  HtmlDanglingMarkerClose = 'HtmlDanglingMarkerClose',
  HtmlRawNode = 'HtmlRawNode',
  AttrSingleQuoted = 'AttrSingleQuoted',
  AttrDoubleQuoted = 'AttrDoubleQuoted',
  AttrUnquoted = 'AttrUnquoted',
  AttrEmpty = 'AttrEmpty',
  TextNode = 'TextNode',
  YAMLFrontmatter = 'YAMLFrontmatter',

  LiquidVariable = 'LiquidVariable',
  LiquidFilter = 'LiquidFilter',
  NamedArgument = 'NamedArgument',
  LiquidLiteral = 'LiquidLiteral',
  String = 'String',
  Number = 'Number',
  Range = 'Range',
  VariableLookup = 'VariableLookup',
  Comparison = 'Comparison',
  LogicalExpression = 'LogicalExpression',

  AssignMarkup = 'AssignMarkup',
  ContentForMarkup = 'ContentForMarkup',
  CycleMarkup = 'CycleMarkup',
  ForMarkup = 'ForMarkup',
  PaginateMarkup = 'PaginateMarkup',
  RawMarkup = 'RawMarkup',
  RenderMarkup = 'RenderMarkup',
  RenderVariableExpression = 'RenderVariableExpression',
}

// These are officially supported with special node types
export enum NamedTags {
  assign = 'assign',
  capture = 'capture',
  case = 'case',
  content_for = 'content_for',
  cycle = 'cycle',
  decrement = 'decrement',
  echo = 'echo',
  elsif = 'elsif',
  for = 'for',
  form = 'form',
  if = 'if',
  include = 'include',
  increment = 'increment',
  layout = 'layout',
  liquid = 'liquid',
  paginate = 'paginate',
  render = 'render',
  section = 'section',
  sections = 'sections',
  tablerow = 'tablerow',
  unless = 'unless',
  when = 'when',
}

export enum Comparators {
  CONTAINS = 'contains',
  EQUAL = '==',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  NOT_EQUAL = '!=',
}

export const HtmlNodeTypes = [
  NodeTypes.HtmlElement,
  NodeTypes.HtmlDanglingMarkerClose,
  NodeTypes.HtmlRawNode,
  NodeTypes.HtmlVoidElement,
  NodeTypes.HtmlSelfClosingElement,
] as const;

export const LiquidNodeTypes = [
  NodeTypes.LiquidTag,
  NodeTypes.LiquidVariableOutput,
  NodeTypes.LiquidBranch,
  NodeTypes.LiquidRawTag,
] as const;

// Those properties create loops that would make walking infinite
export const nonTraversableProperties = new Set([
  'parentNode',
  'prev',
  'next',
  'firstChild',
  'lastChild',
]);
