import { TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { ParserBase } from './base';
import { makeTextNode, makeRawMarkup, makeLiquidRawTag } from './factories';
import type { LiquidTagEnvelope, LiquidOpenWhitespace, LiquidCloseWhitespace } from './factories';
import { ChildFilterMode, filterChildren } from './tree-builder';
import type { Position } from '../types';
import { RawMarkupKinds } from '../ast';
import type { LiquidRawTag, LiquidNode, TextNode, LiquidVariableOutput } from '../ast';
import type { TagDefinitionRaw } from '../environment';
import { LiquidHTMLASTParsingError } from '../errors';
import { parseLiquidDoc } from '../liquid-doc/parser';

/**
 * Interface capturing what raw-tag free functions need from the
 * DocumentParser. The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export interface RawParserDelegate extends ParserBase {
  rawParseHtml: boolean;
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
  const endTagName = `end${tagName}`;

  const endTag = scanForEndTag(parser, endTagName);
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

  const bodyNodes = parseRawTagBody(parser, def, tagName, bodyStart, bodyEnd);

  const body = makeRawMarkup(
    rawMarkupKindForTag(tagName, bodyString),
    bodyString,
    bodyNodes,
    bodyStart,
    bodyEnd,
    parser.getSource(),
  );

  // Re-tokenize from exactly the end tag's end offset. A stray `{{`/`{%`
  // inside the raw body can open a tokenizer mode that greedily runs past
  // the end tag, producing a token that straddles the boundary and swallows
  // legitimate post-end-tag content; reslicing restores a clean token stream
  // so that content (e.g. a trailing `{{ 1 }}`) is parsed normally.
  parser.resliceTokensFrom(endTag.tagEnd);

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

  // The body bound is the stable source offset `bodyEnd`, not a cached token
  // index: parsing a nested raw tag can call `resliceTokensFrom`, which
  // renumbers the tokens at/after the reslice boundary. Re-reading the current
  // token at each step (and re-checking against `bodyEnd`) keeps the walk
  // correct across that mutation; a cached end index would point at a stale slot.
  let i = parser.getPosition();
  while (i < parser.tokenCount() && parser.tokenAt(i).start < bodyEnd) {
    const token = parser.tokenAt(i);

    if (
      token.type === TokenType.LiquidVariableOutputOpen ||
      token.type === TokenType.LiquidTagOpen
    ) {
      // A stray `{{`/`{%` near the body end can open a tokenizer mode that runs
      // past `bodyEnd` (the raw end tag), so its closing `}}`/`%}` lands after
      // the boundary. Parsing it would both produce a body node that spans past
      // the end tag AND leave the same source for `resliceTokensFrom` to re-emit
      // as a post-tag sibling — the range ends up in two overlapping nodes. When
      // the construct does not close within the body, treat the rest of the body
      // as literal text instead, so `body.nodes` matches the bounded `body.value`.
      const closeType =
        token.type === TokenType.LiquidVariableOutputOpen
          ? TokenType.LiquidVariableOutputClose
          : TokenType.LiquidTagClose;
      let j = i + 1;
      while (j < parser.tokenCount() && parser.tokenAt(j).type !== closeType) j++;
      const closesWithinBody = j < parser.tokenCount() && parser.tokenAt(j).end <= bodyEnd;

      if (!closesWithinBody) {
        nodes.push(makeTextNode(source.slice(token.start, bodyEnd), token.start, bodyEnd, source));
        while (i < parser.tokenCount() && parser.tokenAt(i).start < bodyEnd) i++;
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

/**
 * Result of scanning for a raw tag's end tag in the source string.
 *
 * We scan the source directly (rather than the token stream) because the
 * tokenizer doesn't know about raw-tag semantics. Content inside a raw
 * tag body may contain `{%` sequences that the tokenizer greedily enters
 * as LiquidTag mode, mangling the tokens around the real end tag.
 */
export interface EndTagScanResult {
  /** Source offset where the end tag starts (the `{`). */
  tagStart: number;
  /** Source offset where the end tag ends (after `%}`). */
  tagEnd: number;
  /** Opening whitespace-strip marker: `'-'` or `''`. */
  wsStart: LiquidOpenWhitespace;
  /** Closing whitespace-strip marker: `'-'` or `''`. */
  wsEnd: LiquidCloseWhitespace;
}

export function scanForEndTag(parser: ParserBase, endTagName: string): EndTagScanResult | null {
  const source = parser.getSource();
  const searchStart = parser.tokenAt(parser.getPosition()).start;

  // `comment` and `doc` bodies balance nested opens of the same tag before
  // matching their end tag, mirroring Ruby comment.rb v5.13.0's
  // `comment_tag_depth`. `raw` (and every other raw tag) keeps first-match
  // semantics — Ruby's raw does not balance.
  if (endTagName === 'endcomment' || endTagName === 'enddoc') {
    return scanForBalancedEndTag(source, searchStart, endTagName);
  }

  const pattern = new RegExp(`\\{%(-?)\\s*${endTagName}\\s*(-?)%\\}`);
  const match = pattern.exec(source.slice(searchStart));
  if (!match) return null;

  const tagStart = searchStart + match.index;
  const tagEnd = tagStart + match[0].length;
  const wsStart: LiquidOpenWhitespace = match[1] === '-' ? '-' : '';
  const wsEnd: LiquidCloseWhitespace = match[2] === '-' ? '-' : '';

  return { tagStart, tagEnd, wsStart, wsEnd };
}

/**
 * Depth-balancing end-tag scan for `comment`/`doc`. Counts nested opens of the
 * same tag so a `{% comment %}` inside the body is paired with its own
 * `{% endcomment %}` rather than closing the outer block early.
 *
 * `searchStart` is already positioned past the outer open tag, so depth starts
 * at 0 and every `{% comment %}` encountered is a nested open. A nested
 * `{% raw %}`…`{% endraw %}` is carved out — its literal contents (which may
 * contain `{% comment %}`/`{% endcomment %}` text) do not affect the depth —
 * mirroring Ruby's `parse_raw_tag_body`.
 */
function scanForBalancedEndTag(
  source: string,
  searchStart: number,
  endTagName: string,
): EndTagScanResult | null {
  const openTagName = endTagName.slice(3); // "endcomment" -> "comment"
  const scanner = new RegExp(
    `\\{%(-?)\\s*(${openTagName}|${endTagName}|raw|endraw)\\b\\s*(-?)%\\}`,
    'g',
  );
  scanner.lastIndex = searchStart;

  let depth = 0;
  let inRaw = false;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(source)) !== null) {
    const name = match[2];
    if (inRaw) {
      if (name === 'endraw') inRaw = false;
      continue;
    }
    if (name === 'raw') {
      inRaw = true;
    } else if (name === openTagName) {
      depth++;
    } else if (name === endTagName) {
      if (depth === 0) {
        const tagStart = match.index;
        const tagEnd = tagStart + match[0].length;
        const wsStart: LiquidOpenWhitespace = match[1] === '-' ? '-' : '';
        const wsEnd: LiquidCloseWhitespace = match[3] === '-' ? '-' : '';
        return { tagStart, tagEnd, wsStart, wsEnd };
      }
      depth--;
    }
  }
  return null;
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
