import { describe, expect, it } from 'vitest';
import { partialTag } from './partial';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('partialTag', () => {
  it('has block kind', () => {
    expect(partialTag.kind).toBe(TagKind.Block);
  });

  it('has no branches', () => {
    expect(partialTag.branches).toEqual([]);
  });

  it('parses a string expression', () => {
    const result = partialTag.parse('partial', parser("'footer'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.String,
      value: 'footer',
    });
  });
});
