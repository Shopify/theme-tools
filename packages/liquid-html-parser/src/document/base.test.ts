import { describe, it, expect, vi } from 'vitest';
import { ParserBase } from './base';
import { TokenType, tokenize } from './tokenizer';
import type { Token } from './tokenizer';

/**
 * Build `count` adjacent one-character tokens plus a trailing EndOfInput, and
 * count every read of a token's `start`, which is what a seek inspects.
 */
function countingTokens(count: number, startOf: (i: number) => number = (i) => i) {
  const reads = { count: 0 };
  const tokens: Token[] = [];
  for (let i = 0; i < count; i++) {
    const start = startOf(i);
    tokens.push({
      type: TokenType.Text,
      get start() {
        reads.count++;
        return start;
      },
      end: start + 1,
    });
  }
  const endStart = count === 0 ? 0 : startOf(count - 1) + 1;
  tokens.push({ type: TokenType.EndOfInput, start: endStart, end: endStart });
  return { tokens, reads };
}

/** The behaviour `seekToSourceOffset` must keep: the first token at/after the offset. */
function firstTokenAtOrAfter(tokens: Token[], sourceOffset: number): number {
  let i = 0;
  while (i < tokens.length && tokens[i].start < sourceOffset) i++;
  return i;
}

describe('Unit: ParserBase#seekToSourceOffset', () => {
  it('moves to the first token whose start is at or after the offset', () => {
    // Starts 0, 2, 4, 4, 6, ... (a zero-width duplicate at 4, gaps elsewhere)
    const starts = [0, 2, 4, 4, 6, 9, 13];
    const { tokens } = countingTokens(starts.length, (i) => starts[i]);
    const parser = new ParserBase(tokens, ' '.repeat(20));
    for (let offset = 0; offset <= 15; offset++) {
      parser.seekToSourceOffset(offset);
      expect(parser.getPosition(), `offset ${offset}`).toBe(firstTokenAtOrAfter(tokens, offset));
    }
  });

  it('seeks backward to an offset behind the cursor', () => {
    // A nested parse can over-advance the cursor past the offset a caller
    // re-seeks to (see the comment in parseHtmlRawBody).
    const { tokens } = countingTokens(10);
    const parser = new ParserBase(tokens, ' '.repeat(10));
    parser.setPosition(8);
    parser.seekToSourceOffset(3);
    expect(parser.getPosition()).toBe(3);
  });

  it('does not rescan consumed tokens on successive forward seeks', () => {
    // parseHtmlComment and parseHtmlRawBody seek once per node, at increasing
    // offsets. A scan from token 0 on every seek is O(n²) across a document.
    const n = 4096;
    const { tokens, reads } = countingTokens(n);
    const parser = new ParserBase(tokens, ' '.repeat(n));
    for (let offset = 1; offset <= n; offset++) {
      parser.seekToSourceOffset(offset);
      expect(parser.getPosition()).toBe(offset);
    }
    // O(n log n) is ~53k reads here; the quadratic scan does ~8.4M.
    expect(reads.count).toBeLessThan(n * 32);
  });
});

describe('Unit: ParserBase#resliceTokensFrom', () => {
  it('does not rescan the tokens on successive reslices that need no re-tokenize', () => {
    // parseLiquidRaw reslices once per raw Liquid tag ({% raw %}, {% comment %}, ...).
    const n = 4096;
    const { tokens, reads } = countingTokens(n);
    const parser = new ParserBase(tokens, ' '.repeat(n));
    for (let offset = 1; offset <= n; offset++) {
      parser.resliceTokensFrom(offset);
      expect(parser.getPosition()).toBe(offset);
    }
    expect(reads.count).toBeLessThan(n * 32);
  });

  it('re-tokenizes only as far as the parser reads after a straddling raw tag', () => {
    // The stray `{{` in each raw body opens Liquid output that runs past the
    // end tag, so every reslice re-tokenizes. Re-tokenizing the whole rest of
    // the source each time is O(n²) across a document.
    const n = 200;
    const unit = '{% raw %}{{ x{% endraw %}';
    const source = unit.repeat(n) + '}}' + '<a>b</a>'.repeat(n);
    const parser = new ParserBase(tokenize(source), source);
    const starts: number[] = [];
    // The tokenizer probes the source with `startsWith` as it steps through it.
    const spy = vi.spyOn(String.prototype, 'startsWith');
    let probes: number;
    try {
      for (let i = 1; i <= n; i++) {
        parser.resliceTokensFrom(i * unit.length);
        starts.push(parser.peek().start);
      }
      probes = spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
    expect(starts).toEqual(Array.from({ length: n }, (_, i) => (i + 1) * unit.length));
    // Linear is ~4k probes here; the quadratic re-tokenize does ~2.8M.
    expect(probes).toBeLessThan(source.length * 4);
  });
});
