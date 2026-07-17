import { describe, expect, it } from 'vitest';
import { assignTag } from './assign';
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

describe('assignTag', () => {
  it('has standalone kind', () => {
    expect(assignTag.kind).toBe(TagKind.Tag);
  });

  it('parses x = 1', () => {
    const markup = 'x = 1';
    const source = PADDING + markup;
    const result = assignTag.parse('assign', parser(markup), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.AssignMarkup,
      name: 'x',
      value: {
        type: NodeTypes.LiquidVariable,
        expression: { type: NodeTypes.Number, value: '1' },
        filters: [],
      },
    });
    // Position spans the full markup
    expect(source.slice(result.position.start, result.position.end)).toBe(markup);
    // Source propagation on child nodes
    expect(result.value.source).toBe(source);
  });

  it('parses product_title = product.title | upcase', () => {
    const result = assignTag.parse(
      'assign',
      parser('product_title = product.title | upcase'),
      stubParser,
    );
    expect(result).toMatchObject({
      type: NodeTypes.AssignMarkup,
      name: 'product_title',
      value: {
        type: NodeTypes.LiquidVariable,
        expression: {
          type: NodeTypes.VariableLookup,
          name: 'product',
          lookups: [{ type: NodeTypes.String, value: 'title' }],
        },
        filters: [{ type: NodeTypes.LiquidFilter, name: 'upcase', args: [] }],
      },
    });
  });

  it("parses greeting = 'hello'", () => {
    const result = assignTag.parse('assign', parser("greeting = 'hello'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.AssignMarkup,
      name: 'greeting',
      value: {
        type: NodeTypes.LiquidVariable,
        expression: { type: NodeTypes.String, value: 'hello' },
        filters: [],
      },
    });
  });
});
