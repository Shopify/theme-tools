import { describe, expect, it } from 'vitest';
import { layoutTag } from './layout';
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

describe('layoutTag', () => {
  it('has standalone kind', () => {
    expect(layoutTag.kind).toBe(TagKind.Tag);
  });

  it('parses a string expression', () => {
    const result = layoutTag.parse('layout', parser("'default'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.String,
      value: 'default',
    });
  });

  it('parses a variable lookup', () => {
    const result = layoutTag.parse('layout', parser('none'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'none',
      lookups: [],
    });
  });
});
