import { describe, expect, it } from 'vitest';
import { breakTag } from './break';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('breakTag', () => {
  it('has standalone kind', () => {
    expect(breakTag.kind).toBe(TagKind.Tag);
  });

  it('parses empty markup and returns empty string', () => {
    const result = breakTag.parse('break', parser(''), stubParser);
    expect(result).toBe('');
  });

  it('throws on non-empty markup', () => {
    expect(() => breakTag.parse('break', parser('something'), stubParser)).toThrow(
      "'break' tag does not accept markup",
    );
  });
});
