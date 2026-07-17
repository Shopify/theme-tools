import type { LiquidLine } from './environment';
import type { LiquidTagEnvelope } from './document/factories';

/**
 * Construct a LiquidTagEnvelope from a {% liquid %} line.
 * Unlike envelopeFromTokens, liquid lines have no physical delimiters,
 * so whitespace is always '' and blockStartPosition spans the full statement.
 */
export function envelopeFromLine(line: LiquidLine, source: string): LiquidTagEnvelope {
  return {
    tagName: line.tagName,
    markupString: line.markup,
    markupOffset: line.markupOffset,
    markupEnd: line.markupOffset + line.markup.length,
    whitespaceStart: '',
    whitespaceEnd: '',
    blockStartPosition: { start: line.nameOffset, end: line.lineEnd },
    source,
  };
}
