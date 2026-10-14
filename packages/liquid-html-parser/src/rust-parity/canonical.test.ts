import { describe, expect, it } from 'vitest';
import { canonical } from './canonical';
import { LiquidHTMLASTParsingError } from '../errors';

const input = 'ab\ncd';

class Node {
  a = 1;
}

describe('canonical', () => {
  it('gives equal strings for structurally identical values', () => {
    const left = { type: 'Document', source: input, children: [{ a: 1 }] };
    const right = { type: 'Document', source: input, children: [{ a: 1 }] };
    expect(canonical(left, input)).toBe(canonical(right, input));
  });

  it('tells apart two key orders', () => {
    expect(canonical({ a: 1, b: 2 }, input)).not.toBe(canonical({ b: 2, a: 1 }, input));
  });

  it('tells apart a key whose value is undefined from a missing key', () => {
    expect(canonical({ a: undefined }, input)).not.toBe(canonical({}, input));
  });

  it('tells apart a shared object from two equal copies', () => {
    const shared = { x: 1 };
    const aliased = { p: shared, q: shared };
    const copies = { p: { x: 1 }, q: { x: 1 } };
    expect(canonical(aliased, input)).not.toBe(canonical(copies, input));
  });

  it('tells apart a class instance from a plain object', () => {
    expect(canonical(new Node(), input)).not.toBe(canonical({ a: 1 }, input));
  });

  it('tells apart a source that is the input from one that only equals it', () => {
    const identical = { source: input };
    const equalNotIdentical = { source: new String(input) };
    const different = { source: input + ' ' };
    expect(canonical(identical, input)).not.toBe(canonical(equalNotIdentical, input));
    expect(canonical(identical, input)).not.toBe(canonical(different, input));
  });

  it('tells apart two errors that differ only in loc', () => {
    const first = new LiquidHTMLASTParsingError('Unexpected token', input, 0, 1);
    const second = new LiquidHTMLASTParsingError('Unexpected token', input, 3, 4);
    expect(first.message).toBe(second.message);
    expect(canonical(first, input)).not.toBe(canonical(second, input));
  });
});
