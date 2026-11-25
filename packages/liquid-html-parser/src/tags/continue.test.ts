import { describe, expect, it } from 'vitest';
import { continueTag } from './continue';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('continueTag', () => {
  it('has standalone kind', () => {
    expect(continueTag.kind).toBe(TagKind.Tag);
  });

  it('parses empty markup and returns empty string', () => {
    const result = continueTag.parse('continue', parser(''), stubParser);
    expect(result).toBe('');
  });

  it('throws on non-empty markup', () => {
    expect(() => continueTag.parse('continue', parser('something'), stubParser)).toThrow(
      "'continue' tag does not accept markup",
    );
  });
});
