import { describe, expect, it } from 'vitest';
import { incrementTag } from './increment';
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

describe('incrementTag', () => {
  it('has standalone kind', () => {
    expect(incrementTag.kind).toBe(TagKind.Tag);
  });

  it('parses a variable lookup', () => {
    const result = incrementTag.parse('increment', parser('my_counter'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'my_counter',
      lookups: [],
    });
  });
});
