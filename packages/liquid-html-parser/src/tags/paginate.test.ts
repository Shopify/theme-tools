import { describe, expect, it } from 'vitest';
import { paginateTag } from './paginate';
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

describe('paginateTag', () => {
  it('has block kind', () => {
    expect(paginateTag.kind).toBe(TagKind.Block);
  });

  it('has no branches', () => {
    expect(paginateTag.branches).toEqual([]);
  });

  it('parses basic paginate', () => {
    const result = paginateTag.parse('paginate', parser('products by 10'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.PaginateMarkup,
      collection: { type: NodeTypes.VariableLookup, name: 'products' },
      pageSize: { type: NodeTypes.Number, value: '10' },
      args: [],
    });
  });

  it('parses paginate with named args', () => {
    const result = paginateTag.parse(
      'paginate',
      parser('products by 10, window_size: 3'),
      stubParser,
    );
    expect(result).toMatchObject({
      type: NodeTypes.PaginateMarkup,
      collection: { type: NodeTypes.VariableLookup, name: 'products' },
      pageSize: { type: NodeTypes.Number, value: '10' },
    });
    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'window_size',
      value: { type: NodeTypes.Number, value: '3' },
    });
  });
});
