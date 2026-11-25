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

  it("parses 'key' | t: with no arguments", () => {
    const markup = "'key' | t:  ";
    const result = echoTag.parse('echo', parser(markup), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.LiquidVariable,
      rawSource: "'key' | t:",
      filters: [
        {
          type: NodeTypes.LiquidFilter,
          name: 't',
          args: [],
          position: { start: OFFSET + 5, end: OFFSET + 10 },
        },
      ],
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
