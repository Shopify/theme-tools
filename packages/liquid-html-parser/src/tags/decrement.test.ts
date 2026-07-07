import { describe, expect, it } from 'vitest';
import { TagKind, type Parser } from '../environment';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { decrementTag } from './decrement';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('decrementTag', () => {
  it('has standalone kind', () => {
    expect(decrementTag.kind).toBe(TagKind.Tag);
  });

  it('parses a variable lookup', () => {
    const result = decrementTag.parse('decrement', parser('my_counter'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'my_counter',
      lookups: [],
    });
  });
});
