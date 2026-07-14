import type { Token } from './tokenizer';
import type { Position } from '../types';
import { NodeTypes, RawTags } from '../types';
import type {
  DocumentNode,
  YAMLFrontmatter,
  LiquidTagBaseCase,
  LiquidTagNamed,
  LiquidBranchUnnamed,
  LiquidBranchNamed,
  LiquidRawTag,
  TextNode,
  RawMarkup,
  LiquidVariable,
  LiquidVariableOutput,
  LiquidHtmlNode,
  LiquidNode,
  HtmlElement,
  HtmlVoidElement,
  HtmlSelfClosingElement,
  HtmlRawNode,
  HtmlComment,
  HtmlDoctype,
  HtmlDanglingMarkerClose,
  AttrDoubleQuoted,
  AttrSingleQuoted,
  AttrUnquoted,
  AttrEmpty,
  AttributeNode,
  ValueNode,
  CompoundNameSegment,
} from '../ast';
import { RawMarkupKinds } from '../ast';

export type LiquidOpenWhitespace = '-' | '';
export type LiquidCloseWhitespace = '-' | '';

export interface LiquidTagEnvelope {
  tagName: string;
  markupString: string;
  markupOffset: number;
  /** The end position of the markup in the source (exclusive). Aligned with markupOffset. */
  markupEnd: number;
  whitespaceStart: LiquidOpenWhitespace;
  whitespaceEnd: LiquidCloseWhitespace;
  blockStartPosition: Position;
  source: string;
}

export function makeDocumentNode(children: LiquidHtmlNode[], source: string): DocumentNode {
  return {
    type: NodeTypes.Document,
    children,
    name: '#document',
    _source: source,
    position: { start: 0, end: source.length },
    source,
  };
}

export function envelopeFromTokens(
  openToken: Token,
  closeToken: Token,
  source: string,
): LiquidTagEnvelope {
  const inner = source.slice(openToken.end, closeToken.start);
  const trimmed = inner.trimStart();
  const leadingSpaces = inner.length - trimmed.length;

  const firstWhitespace = trimmed.search(/\s/);
  const tagName = firstWhitespace === -1 ? trimmed.trim() : trimmed.slice(0, firstWhitespace);

  const tagNameStartInInner = leadingSpaces;
  const afterTagName = tagNameStartInInner + tagName.length;
  const markupString = inner.slice(afterTagName);

  // markupOffset points to the first non-whitespace character of the markup in source
  let markupOffsetInInner = afterTagName;
  while (
    markupOffsetInInner < inner.length &&
    (inner[markupOffsetInInner] === ' ' || inner[markupOffsetInInner] === '\t')
  ) {
    markupOffsetInInner++;
  }
  const markupOffset = openToken.end + markupOffsetInInner;

  const whitespaceStart: LiquidOpenWhitespace = openToken.end - openToken.start > 2 ? '-' : '';
  const whitespaceEnd: LiquidCloseWhitespace = closeToken.end - closeToken.start > 2 ? '-' : '';

  return {
    tagName,
    markupString,
    markupOffset,
    markupEnd: closeToken.start,
    whitespaceStart,
    whitespaceEnd,
    blockStartPosition: { start: openToken.start, end: closeToken.end },
    source,
  };
}

export function makeLiquidTagBaseCase(
  envelope: LiquidTagEnvelope,
  children?: LiquidHtmlNode[],
  blockEndPosition?: Position,
  delimiterWhitespace?: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace },
  reason?: string,
): LiquidTagBaseCase {
  const posEnd = blockEndPosition ? blockEndPosition.end : envelope.blockStartPosition.end;
  return {
    type: NodeTypes.LiquidTag,
    name: envelope.tagName,
    markup: envelope.markupString.trim(),
    children,
    whitespaceStart: envelope.whitespaceStart,
    whitespaceEnd: envelope.whitespaceEnd,
    delimiterWhitespaceStart: delimiterWhitespace?.start,
    delimiterWhitespaceEnd: delimiterWhitespace?.end,
    blockStartPosition: envelope.blockStartPosition,
    blockEndPosition,
    markupPosition: { start: envelope.markupOffset, end: envelope.markupEnd },
    position: { start: envelope.blockStartPosition.start, end: posEnd },
    source: envelope.source,
    reason: reason,
  };
}

export function makeLiquidTagNamed(
  envelope: LiquidTagEnvelope,
  markup: unknown,
  children?: LiquidHtmlNode[],
  blockEndPosition?: Position,
  delimiterWhitespace?: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace },
): LiquidTagNamed {
  const posEnd = blockEndPosition ? blockEndPosition.end : envelope.blockStartPosition.end;
  return {
    type: NodeTypes.LiquidTag,
    name: envelope.tagName,
    markup,
    children,
    whitespaceStart: envelope.whitespaceStart,
    whitespaceEnd: envelope.whitespaceEnd,
    delimiterWhitespaceStart: delimiterWhitespace?.start,
    delimiterWhitespaceEnd: delimiterWhitespace?.end,
    blockStartPosition: envelope.blockStartPosition,
    blockEndPosition,
    markupPosition: { start: envelope.markupOffset, end: envelope.markupEnd },
    position: { start: envelope.blockStartPosition.start, end: posEnd },
    source: envelope.source,
  } as LiquidTagNamed;
}

export function makeLiquidBranchUnnamed(bodyStart: number, source: string): LiquidBranchUnnamed {
  return {
    type: NodeTypes.LiquidBranch,
    name: null,
    markup: '',
    children: [],
    whitespaceStart: '',
    whitespaceEnd: '',
    markupPosition: { start: bodyStart, end: bodyStart },
    blockStartPosition: { start: bodyStart, end: bodyStart },
    blockEndPosition: { start: -1, end: -1 },
    position: { start: bodyStart, end: bodyStart },
    source,
  };
}

export function makeLiquidBranchNamed(
  envelope: LiquidTagEnvelope,
  markup: unknown,
): LiquidBranchNamed {
  return {
    type: NodeTypes.LiquidBranch,
    name: envelope.tagName,
    markup,
    children: [],
    whitespaceStart: envelope.whitespaceStart,
    whitespaceEnd: envelope.whitespaceEnd,
    markupPosition: { start: envelope.markupOffset, end: envelope.markupEnd },
    blockStartPosition: envelope.blockStartPosition,
    blockEndPosition: { start: -1, end: -1 },
    position: {
      start: envelope.blockStartPosition.start,
      end: envelope.blockStartPosition.end,
    },
    source: envelope.source,
  } as LiquidBranchNamed;
}

export function makeLiquidRawTag(
  envelope: LiquidTagEnvelope,
  body: RawMarkup,
  blockEndPosition: Position,
  delimiterWhitespace: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace },
): LiquidRawTag {
  let markupEnd = envelope.markupEnd;
  while (
    markupEnd > envelope.markupOffset &&
    (envelope.source[markupEnd - 1] === ' ' || envelope.source[markupEnd - 1] === '\t')
  ) {
    markupEnd--;
  }

  return {
    type: NodeTypes.LiquidRawTag,
    name: envelope.tagName as RawTags,
    markup: envelope.markupString.trim(),
    markupPosition: { start: envelope.markupOffset, end: markupEnd },
    body,
    whitespaceStart: envelope.whitespaceStart,
    whitespaceEnd: envelope.whitespaceEnd,
    delimiterWhitespaceStart: delimiterWhitespace.start,
    delimiterWhitespaceEnd: delimiterWhitespace.end,
    blockStartPosition: envelope.blockStartPosition,
    blockEndPosition,
    position: { start: envelope.blockStartPosition.start, end: blockEndPosition.end },
    source: envelope.source,
  };
}

export function makeLiquidVariableOutput(
  openToken: Token,
  closeToken: Token,
  markup: string | LiquidVariable,
  source: string,
): LiquidVariableOutput {
  return {
    type: NodeTypes.LiquidVariableOutput,
    markup,
    whitespaceStart: openToken.end - openToken.start > 2 ? '-' : '',
    whitespaceEnd: closeToken.end - closeToken.start > 2 ? '-' : '',
    markupPosition: { start: openToken.end, end: closeToken.start },
    position: { start: openToken.start, end: closeToken.end },
    source,
  };
}

export function makeTextNode(value: string, start: number, end: number, source: string): TextNode {
  return {
    type: NodeTypes.TextNode,
    value,
    position: { start, end },
    source,
  };
}

export function makeRawMarkup(
  kind: RawMarkupKinds,
  value: string,
  nodes: (LiquidNode | TextNode)[],
  start: number,
  end: number,
  source: string,
): RawMarkup {
  return {
    type: NodeTypes.RawMarkup,
    kind,
    value,
    nodes,
    position: { start, end },
    source,
  };
}

export function makeYamlFrontmatter(
  body: string,
  start: number,
  end: number,
  source: string,
): YAMLFrontmatter {
  return {
    type: NodeTypes.YAMLFrontmatter,
    body,
    position: { start, end },
    source,
  };
}

export function makeHtmlElement(
  name: CompoundNameSegment[],
  attributes: AttributeNode[],
  children: LiquidHtmlNode[],
  blockStartPosition: Position,
  blockEndPosition: Position,
  source: string,
): HtmlElement {
  return {
    type: NodeTypes.HtmlElement,
    name,
    attributes,
    children,
    blockStartPosition,
    blockEndPosition,
    position: { start: blockStartPosition.start, end: blockEndPosition.end },
    source,
  };
}

export function makeHtmlVoidElement(
  name: string,
  attributes: AttributeNode[],
  blockStartPosition: Position,
  source: string,
): HtmlVoidElement {
  return {
    type: NodeTypes.HtmlVoidElement,
    name,
    attributes,
    blockStartPosition,
    position: blockStartPosition,
    source,
  };
}

export function makeHtmlSelfClosingElement(
  name: CompoundNameSegment[],
  attributes: AttributeNode[],
  blockStartPosition: Position,
  source: string,
): HtmlSelfClosingElement {
  return {
    type: NodeTypes.HtmlSelfClosingElement,
    name,
    attributes,
    blockStartPosition,
    position: blockStartPosition,
    source,
  };
}

export function makeHtmlRawNode(
  name: string,
  attributes: AttributeNode[],
  body: RawMarkup,
  blockStartPosition: Position,
  blockEndPosition: Position,
  source: string,
): HtmlRawNode {
  return {
    type: NodeTypes.HtmlRawNode,
    name,
    attributes,
    body,
    blockStartPosition,
    blockEndPosition,
    position: { start: blockStartPosition.start, end: blockEndPosition.end },
    source,
  };
}

export function makeHtmlComment(
  body: string,
  start: number,
  end: number,
  source: string,
): HtmlComment {
  return {
    type: NodeTypes.HtmlComment,
    body,
    position: { start, end },
    source,
  };
}

export function makeHtmlDoctype(
  legacyDoctypeString: string | null,
  start: number,
  end: number,
  source: string,
): HtmlDoctype {
  return {
    type: NodeTypes.HtmlDoctype,
    legacyDoctypeString,
    position: { start, end },
    source,
  };
}

export function makeAttrDoubleQuoted(
  name: CompoundNameSegment[],
  value: ValueNode[],
  attributePosition: Position,
  start: number,
  end: number,
  source: string,
): AttrDoubleQuoted {
  return {
    type: NodeTypes.AttrDoubleQuoted,
    name,
    value,
    attributePosition,
    position: { start, end },
    source,
  };
}

export function makeAttrSingleQuoted(
  name: CompoundNameSegment[],
  value: ValueNode[],
  attributePosition: Position,
  start: number,
  end: number,
  source: string,
): AttrSingleQuoted {
  return {
    type: NodeTypes.AttrSingleQuoted,
    name,
    value,
    attributePosition,
    position: { start, end },
    source,
  };
}

export function makeAttrUnquoted(
  name: CompoundNameSegment[],
  value: ValueNode[],
  attributePosition: Position,
  start: number,
  end: number,
  source: string,
): AttrUnquoted {
  return {
    type: NodeTypes.AttrUnquoted,
    name,
    value,
    attributePosition,
    position: { start, end },
    source,
  };
}

export function makeAttrEmpty(
  name: CompoundNameSegment[],
  start: number,
  end: number,
  source: string,
): AttrEmpty {
  return {
    type: NodeTypes.AttrEmpty,
    name,
    position: { start, end },
    source,
  };
}

export function makeHtmlDanglingMarkerClose(
  name: CompoundNameSegment[],
  start: number,
  end: number,
  source: string,
): HtmlDanglingMarkerClose {
  return {
    type: NodeTypes.HtmlDanglingMarkerClose,
    name,
    blockStartPosition: { start, end },
    position: { start, end },
    source,
  };
}
