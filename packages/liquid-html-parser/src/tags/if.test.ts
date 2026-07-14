import { describe, expect, it } from 'vitest';
import { ifTag, unlessTag, elsifBranchParse } from './if';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes, Comparators } from '../types';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('ifTag', () => {
  it('has block kind', () => {
    expect(ifTag.kind).toBe(TagKind.Block);
  });

  it('has elsif and else branches', () => {
    expect(ifTag.branches).toEqual(['elsif', 'else']);
  });

  it('parses a comparison expression', () => {
    const result = ifTag.parse('if', parser('a > 1'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.Comparison,
      comparator: Comparators.GREATER_THAN,
      left: { type: NodeTypes.VariableLookup, name: 'a' },
      right: { type: NodeTypes.Number, value: '1' },
    });
  });
});

describe('unlessTag', () => {
  it('has block kind', () => {
    expect(unlessTag.kind).toBe(TagKind.Block);
  });

  it('parses a literal expression', () => {
    const result = unlessTag.parse('unless', parser('blank'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.LiquidLiteral,
      keyword: 'blank',
      value: '',
    });
  });
});

describe('elsifBranchParse', () => {
  it('parses a conditional expression', () => {
    const result = elsifBranchParse('elsif', parser('product.available'));
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'product',
      lookups: [{ type: NodeTypes.String, value: 'available' }],
    });
  });
});
