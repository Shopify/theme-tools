import { describe, expect, it } from 'vitest';
import { ifchangedTag } from './ifchanged';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('ifchangedTag', () => {
  it('has block kind', () => {
    expect(ifchangedTag.kind).toBe(TagKind.Block);
  });

  it('has no branches', () => {
    expect(ifchangedTag.branches).toEqual([]);
  });

  it('parses empty markup', () => {
    const result = ifchangedTag.parse('ifchanged', parser(''), stubParser);
    expect(result).toBeNull();
  });
});
