import { TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { ParserBase } from './base';
import { makeLiquidTagBaseCase, makeLiquidTagNamed } from './factories';
import type { LiquidTagEnvelope } from './factories';
import type { LiquidTag } from '../ast';
import type { TagDefinitionHybrid } from '../environment';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import { parseBlockBody } from './liquid-blocks';
import type { BlockParserDelegate } from './liquid-blocks';

/**
 * Interface capturing what hybrid-tag free functions need from the
 * DocumentParser. The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export type HybridParserDelegate = BlockParserDelegate;

// hybridTag := standaloneTag | "{%" tagName markup "%}" blockBody "{%" "end" tagName "%}"
export function parseHybridTag(
  parser: HybridParserDelegate,
  def: TagDefinitionHybrid,
  envelope: LiquidTagEnvelope,
  closeToken: Token,
): LiquidTag {
  let markup: unknown;
  let markupParsed = false;
  let reason: string | undefined;
  try {
    const markupStringStart = closeToken.start - envelope.markupString.length;
    const tokens = tokenizeMarkup(envelope.markupString, markupStringStart);
    const markupParser = new MarkupParser(tokens, parser.getSource());
    markup = def.parse(envelope.tagName, markupParser, parser);
    if (!markupParser.isAtEnd()) {
      markup = undefined;
      reason = 'unexpected tokens after markup';
    } else {
      markupParsed = true;
    }
  } catch (e) {
    markup = undefined;
    reason = e instanceof Error ? e.message : 'unknown error';
  }

  const endTagIndex = scanForEndTagNested(parser, envelope.tagName);

  if (endTagIndex === -1) {
    if (markupParsed) {
      return makeLiquidTagNamed(envelope, markup);
    }
    return makeLiquidTagBaseCase(envelope, undefined, undefined, undefined, reason);
  }

  const { children, endPosition, endWhitespace } = parseBlockBody(parser, envelope);

  if (markupParsed) {
    return makeLiquidTagNamed(envelope, markup, children, endPosition, endWhitespace);
  }
  return makeLiquidTagBaseCase(envelope, children, endPosition, endWhitespace, reason);
}

/**
 * Scan forward for a matching end tag, respecting nesting of same-named tags.
 * Returns the token index of the end tag's LiquidTagOpen, or -1 if not found.
 */
export function scanForEndTagNested(parser: ParserBase, tagName: string): number {
  let depth = 0;
  const endTagName = `end${tagName}`;
  const source = parser.getSource();
  const tokenCount = parser.tokenCount();
  const pos = parser.getPosition();

  for (let i = pos; i < tokenCount; i++) {
    if (parser.tokenAt(i).type !== TokenType.LiquidTagOpen) continue;

    const textIdx = i + 1;
    if (textIdx >= tokenCount) continue;
    if (parser.tokenAt(textIdx).type !== TokenType.Text) continue;

    const textToken = parser.tokenAt(textIdx);
    const text = source.slice(textToken.start, textToken.end);
    const trimmed = text.trimStart();
    const firstWs = trimmed.search(/\s/);
    const name = firstWs === -1 ? trimmed.trim() : trimmed.slice(0, firstWs);

    if (name === tagName) {
      depth++;
    } else if (name === endTagName) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}
