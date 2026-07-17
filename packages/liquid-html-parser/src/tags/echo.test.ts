import { describe, expect, it } from 'vitest';
import { echoTag } from './echo';
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

describe('echoTag', () => {
  it('has standalone kind', () => {
    expect(echoTag.kind).toBe(TagKind.Tag);
  });

  it('parses product.title', () => {
    const result = echoTag.parse('echo', parser('product.title'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.LiquidVariable,
      expression: {
        type: NodeTypes.VariableLookup,
        name: 'product',
        lookups: [{ type: NodeTypes.String, value: 'title' }],
      },
      filters: [],
    });
  });

  it('parses product.title | upcase', () => {
    const result = echoTag.parse('echo', parser('product.title | upcase'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.LiquidVariable,
      expression: {
        type: NodeTypes.VariableLookup,
        name: 'product',
      },
      filters: [{ type: NodeTypes.LiquidFilter, name: 'upcase', args: [] }],
    });
  });

  it("parses 'hello' | append: ' world'", () => {
    const result = echoTag.parse('echo', parser("'hello' | append: ' world'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.LiquidVariable,
      expression: { type: NodeTypes.String, value: 'hello' },
      filters: [
        {
          type: NodeTypes.LiquidFilter,
          name: 'append',
          args: [{ type: NodeTypes.String, value: ' world' }],
        },
      ],
    });
  });
});
