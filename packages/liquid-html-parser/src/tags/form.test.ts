import { describe, expect, it } from 'vitest';
import { formTag } from './form';
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

describe('formTag', () => {
  it('has block kind', () => {
    expect(formTag.kind).toBe(TagKind.Block);
  });

  it('has no branches', () => {
    expect(formTag.branches).toEqual([]);
  });

  it('parses form with type and object', () => {
    const result = formTag.parse('form', parser("'product', product"), stubParser);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: NodeTypes.String,
      value: 'product',
    });
    expect(result[1]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'product',
    });
  });

  it('parses form with type, object, and named args', () => {
    const result = formTag.parse('form', parser("'product', product, id: 'form-id'"), stubParser);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      type: NodeTypes.String,
      value: 'product',
    });
    expect(result[1]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'product',
    });
    expect(result[2]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'id',
      value: { type: NodeTypes.String, value: 'form-id' },
    });
  });
});
