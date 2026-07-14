import { describe, it, expect } from 'vitest';
import { envelopeFromLine } from './shared';
import type { LiquidLine } from './environment';

const OFFSET = 5;
const PAD = 'x'.repeat(OFFSET);

function makeLine(overrides: Partial<LiquidLine> & Pick<LiquidLine, 'tagName'>): LiquidLine {
  return {
    markup: '',
    markupOffset: 0,
    nameOffset: 0,
    lineEnd: 0,
    ...overrides,
  };
}

describe('Unit: envelopeFromLine', () => {
  it('extracts tag name and markup from a line with markup', () => {
    const source = PAD + 'assign x = 1\n';
    const line = makeLine({
      tagName: 'assign',
      markup: 'x = 1',
      markupOffset: OFFSET + 7,
      nameOffset: OFFSET,
      lineEnd: OFFSET + 13,
    });
    const envelope = envelopeFromLine(line, source);

    expect(envelope.tagName).toBe('assign');
    expect(envelope.markupString).toBe('x = 1');
    expect(envelope.markupOffset).toBe(OFFSET + 7);
    expect(source[envelope.markupOffset]).toBe('x');
    expect(envelope.whitespaceStart).toBe('');
    expect(envelope.whitespaceEnd).toBe('');
    expect(envelope.blockStartPosition).toEqual({ start: OFFSET, end: OFFSET + 13 });
    expect(envelope.source).toBe(source);
  });

  it('handles a line without markup', () => {
    const source = PAD + 'break\n';
    const line = makeLine({
      tagName: 'break',
      markup: '',
      markupOffset: OFFSET + 5,
      nameOffset: OFFSET,
      lineEnd: OFFSET + 5,
    });
    const envelope = envelopeFromLine(line, source);

    expect(envelope.tagName).toBe('break');
    expect(envelope.markupString).toBe('');
    expect(envelope.blockStartPosition).toEqual({ start: OFFSET, end: OFFSET + 5 });
  });

  it('whitespaceStart and whitespaceEnd are always empty strings', () => {
    const source = PAD + '  assign x = 1\n';
    const line = makeLine({
      tagName: 'assign',
      markup: 'x = 1',
      markupOffset: OFFSET + 9,
      nameOffset: OFFSET + 2,
      lineEnd: OFFSET + 14,
    });
    const envelope = envelopeFromLine(line, source);

    expect(envelope.whitespaceStart).toBe('');
    expect(envelope.whitespaceEnd).toBe('');
  });

  it('blockStartPosition spans from nameOffset to lineEnd', () => {
    const nameOffset = 42;
    const lineEnd = 60;
    const line = makeLine({
      tagName: 'echo',
      markup: 'product.title',
      markupOffset: 47,
      nameOffset,
      lineEnd,
    });
    const envelope = envelopeFromLine(line, 'x'.repeat(100));

    const bsp = envelope.blockStartPosition;
    expect(bsp.start).toBe(nameOffset);
    expect(bsp.end).toBe(lineEnd);
  });

  it('passes source through unchanged', () => {
    const source = 'the full document source {% liquid assign x = 1 %}';
    const line = makeLine({
      tagName: 'assign',
      markup: 'x = 1',
      markupOffset: 10,
      nameOffset: 3,
      lineEnd: 15,
    });
    const envelope = envelopeFromLine(line, source);

    expect(envelope.source).toBe(source);
  });

  it('handles different offsets for document-relative positions', () => {
    const bigOffset = 500;
    const source = 'a'.repeat(bigOffset) + 'increment counter\n';
    const line = makeLine({
      tagName: 'increment',
      markup: 'counter',
      markupOffset: bigOffset + 10,
      nameOffset: bigOffset,
      lineEnd: bigOffset + 17,
    });
    const envelope = envelopeFromLine(line, source);

    expect(envelope.tagName).toBe('increment');
    expect(envelope.markupString).toBe('counter');
    expect(envelope.markupOffset).toBe(bigOffset + 10);
    expect(source[envelope.markupOffset]).toBe('c');
    expect(envelope.blockStartPosition.start).toBe(bigOffset);
    expect(envelope.blockStartPosition.end).toBe(bigOffset + 17);
  });
});
