import { TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { ParserBase } from './base';
import { makeTextNode, makeRawMarkup, makeLiquidRawTag } from './factories';
import type { LiquidTagEnvelope } from './factories';
import { ChildFilterMode, filterChildren } from './tree-builder';
import type { Position } from '../types';
import { RawMarkupKinds } from '../ast';
import type { LiquidRawTag, LiquidNode, TextNode, LiquidVariableOutput } from '../ast';
import type { TagDefinition, TagDefinitionRaw } from '../environment';
import { findRawBodyEnd, rawBodyRuleLookup } from './raw-body';
import { LiquidHTMLASTParsingError } from '../errors';
import { parseLiquidDoc } from '../liquid-doc/parser';

/**
 * Interface capturing what raw-tag free functions need from the
 * DocumentParser. The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export interface RawParserDelegate extends ParserBase {
  rawParseHtml: boolean;
  tagForName(name: string): TagDefinition | undefined;
  parseLiquidVariableOutput(): LiquidVariableOutput;
  parseLiquidTag(): LiquidRawTag | import('../ast').LiquidTag;
}

// rawTag := "{%" tagName markup "%}" rawBody "{%" "end" tagName "%}"
export function parseRawTag(
  parser: RawParserDelegate,
  def: TagDefinitionRaw,
  envelope: LiquidTagEnvelope,
  closeToken: Token,
): LiquidRawTag {
  const tagName = envelope.tagName;

  const endTag =
    parser.rawBodyEndFor(closeToken) ??
    findRawBodyEnd(
      parser.getSource(),
      closeToken.end,
      tagName,
      def.body,
      rawBodyRuleLookup((name) => parser.tagForName(name)),
    );
  if (!endTag) {
    throw new LiquidHTMLASTParsingError(
      `Attempting to end parsing before LiquidRawTag '${tagName}' was closed`,
      parser.getSource(),
      envelope.blockStartPosition.start,
      envelope.blockStartPosition.end,
    );
  }

  const bodyStart = closeToken.end;
  const bodyEnd = endTag.tagStart;
  const bodyString = parser.getSource().slice(bodyStart, bodyEnd);

  parser.ensureRawBoundary(bodyStart, bodyEnd);
  const bodyNodes = parseRawTagBody(parser, def, tagName, bodyStart, bodyEnd);

  const body = makeRawMarkup(
    rawMarkupKindForTag(tagName, bodyString),
    bodyString,
    bodyNodes,
    bodyStart,
    bodyEnd,
    parser.getSource(),
  );

  // Body parsing or boundary recovery may move the cursor; offsets stay stable.
  parser.seekToSourceOffset(endTag.tagEnd);

  const endPosition: Position = { start: endTag.tagStart, end: endTag.tagEnd };

  return makeLiquidRawTag(envelope, body, endPosition, {
    start: endTag.wsStart,
    end: endTag.wsEnd,
  });
}

// liquidInRange := (text | liquidVariableOutput | liquidTag)*
export function parseLiquidInRange(
  parser: RawParserDelegate,
  _bodyStart: number,
  bodyEnd: number,
): (LiquidNode | TextNode)[] {
  const nodes: (LiquidNode | TextNode)[] = [];
  const source = parser.getSource();

  // Raw bodies should not parse HTML — disable it for the duration so that
  // block tags (e.g. {% if %}) inside SVG/script bodies treat child HTML
  // tokens as TextNode instead of HtmlElement.
  const savedParseHtml = parser.rawParseHtml;
  parser.rawParseHtml = false;

  // Keep the walk within the source body even when parsing a nested tag
  // advances the token cursor beyond it.
  let i = parser.getPosition();
  while (parser.hasToken(i) && parser.tokenAt(i).start < bodyEnd) {
    const token = parser.tokenAt(i);

    if (
      token.type === TokenType.LiquidVariableOutputOpen ||
      token.type === TokenType.LiquidTagOpen
    ) {
      // An unfinished opener is literal body text. Do not let its node extend
      // beyond this body or overlap the sibling after the raw end tag.
      const closeType =
        token.type === TokenType.LiquidVariableOutputOpen
          ? TokenType.LiquidVariableOutputClose
          : TokenType.LiquidTagClose;
      let j = i + 1;
      while (parser.hasToken(j) && parser.tokenAt(j).type !== closeType) j++;
      const closesWithinBody = parser.hasToken(j) && parser.tokenAt(j).end <= bodyEnd;

      if (!closesWithinBody) {
        nodes.push(makeTextNode(source.slice(token.start, bodyEnd), token.start, bodyEnd, source));
        while (parser.hasToken(i) && parser.tokenAt(i).start < bodyEnd) i++;
        break;
      }

      parser.setPosition(i);
      nodes.push(
        token.type === TokenType.LiquidVariableOutputOpen
          ? parser.parseLiquidVariableOutput()
          : parser.parseLiquidTag(),
      );
      i = parser.getPosition();
      continue;
    }

    nodes.push(makeTextNode(source.slice(token.start, token.end), token.start, token.end, source));
    i++;
  }

  parser.rawParseHtml = savedParseHtml;
  parser.setPosition(i);
  return filterChildren(ChildFilterMode.Syntactic, nodes, source) as (LiquidNode | TextNode)[];
}

// rawBody := liquidDoc | (text | liquidVariableOutput | liquidTag)* | ""
export function parseRawTagBody(
  parser: RawParserDelegate,
  def: TagDefinitionRaw,
  tagName: string,
  bodyStart: number,
  bodyEnd: number,
): (LiquidNode | TextNode)[] {
  if (tagName === 'doc') {
    const bodyString = parser.getSource().slice(bodyStart, bodyEnd);
    return parseLiquidDoc(bodyString, bodyStart, parser.getSource()) as (LiquidNode | TextNode)[];
  }

  if (def.parseLiquidInBody === true) {
    return parseLiquidInRange(parser, bodyStart, bodyEnd);
  }

  if (bodyStart >= bodyEnd) return [];

  const source = parser.getSource();
  const bodyText = source.slice(bodyStart, bodyEnd);
  const textNode = makeTextNode(bodyText, bodyStart, bodyEnd, source);
  return filterChildren(ChildFilterMode.Syntactic, [textNode], source) as (LiquidNode | TextNode)[];
}

export function rawMarkupKindForTag(tagName: string, bodySource: string = ''): RawMarkupKinds {
  switch (tagName) {
    case 'javascript':
      return RawMarkupKinds.javascript;
    case 'stylesheet':
      return /\{[{%]/.test(bodySource) ? RawMarkupKinds.text : RawMarkupKinds.css;
    case 'style':
      return /\{[{%]/.test(bodySource) ? RawMarkupKinds.text : RawMarkupKinds.css;
    case 'schema':
      return RawMarkupKinds.json;
    case 'raw':
    case 'comment':
    case 'doc':
      return RawMarkupKinds.text;
    default:
      return RawMarkupKinds.text;
  }
}
