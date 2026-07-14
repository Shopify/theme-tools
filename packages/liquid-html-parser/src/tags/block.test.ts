import { describe, expect, it } from 'vitest';
import { blockTag } from './block';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';
import { LiquidHTMLASTParsingError } from '../errors';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('blockTag', () => {
  it('has block kind', () => {
    expect(blockTag.kind).toBe(TagKind.Block);
  });

  it('has no branches', () => {
    expect(blockTag.branches).toEqual([]);
  });

  it('parses block with name only', () => {
    const result = blockTag.parse('block', parser("'name'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.BlockMarkup,
      name: { type: NodeTypes.String, value: 'name' },
      args: [],
    });
  });

  it('parses block with named args', () => {
    const result = blockTag.parse('block', parser("'name', key: value"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.BlockMarkup,
      name: { type: NodeTypes.String, value: 'name' },
    });
    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'key',
      value: { type: NodeTypes.VariableLookup, name: 'value' },
    });
  });

  describe('array-literal named args (block-only)', () => {
    it('parses an array of strings', () => {
      const result = blockTag.parse('block', parser("'name', items: ['a', 'b']"), stubParser);
      expect(result.args).toHaveLength(1);
      expect(result.args[0]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'items',
        value: {
          type: 'BlockArrayLiteral',
          elements: [
            { type: NodeTypes.String, value: 'a' },
            { type: NodeTypes.String, value: 'b' },
          ],
        },
      });
    });

    it('parses an array of numbers', () => {
      const result = blockTag.parse('block', parser("'name', items: [1, 2]"), stubParser);
      expect(result.args[0]).toMatchObject({
        name: 'items',
        value: {
          type: 'BlockArrayLiteral',
          elements: [
            { type: NodeTypes.Number, value: '1' },
            { type: NodeTypes.Number, value: '2' },
          ],
        },
      });
    });

    it('parses a mixed array with a variable element', () => {
      const result = blockTag.parse('block', parser("'name', items: ['a', x]"), stubParser);
      expect(result.args[0]).toMatchObject({
        name: 'items',
        value: {
          type: 'BlockArrayLiteral',
          elements: [
            { type: NodeTypes.String, value: 'a' },
            { type: NodeTypes.VariableLookup, name: 'x', lookups: [] },
          ],
        },
      });
    });

    it('parses an empty array', () => {
      const result = blockTag.parse('block', parser("'name', items: []"), stubParser);
      expect(result.args[0]).toMatchObject({
        name: 'items',
        value: { type: 'BlockArrayLiteral', elements: [] },
      });
    });

    it('tolerates a trailing comma inside the array', () => {
      const result = blockTag.parse('block', parser("'name', items: ['a',]"), stubParser);
      expect(result.args[0]).toMatchObject({
        name: 'items',
        value: {
          type: 'BlockArrayLiteral',
          elements: [{ type: NodeTypes.String, value: 'a' }],
        },
      });
    });

    it('parses a dotted block.settings.* name with an array value', () => {
      const result = blockTag.parse(
        'block',
        parser("'name', block.settings.collections: ['a', 'b']"),
        stubParser,
      );
      expect(result.args[0]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'block.settings.collections',
        value: {
          type: 'BlockArrayLiteral',
          elements: [
            { type: NodeTypes.String, value: 'a' },
            { type: NodeTypes.String, value: 'b' },
          ],
        },
      });
    });

    it('[some_var] is a 1-element array literal', () => {
      const result = blockTag.parse('block', parser("'name', items: [some_var]"), stubParser);
      expect(result.args).toHaveLength(1);
      expect(result.args[0]).toMatchObject({
        name: 'items',
        value: {
          type: 'BlockArrayLiteral',
          elements: [{ type: NodeTypes.VariableLookup, name: 'some_var', lookups: [] }],
        },
      });
    });

    it("['product'] is a 1-element array literal", () => {
      const result = blockTag.parse('block', parser("'name', items: ['product']"), stubParser);
      expect(result.args).toHaveLength(1);
      expect(result.args[0]).toMatchObject({
        name: 'items',
        value: {
          type: 'BlockArrayLiteral',
          elements: [{ type: NodeTypes.String, value: 'product' }],
        },
      });
    });

    it('["x"].y throws (leading bracket is an array)', () => {
      expect(() =>
        blockTag.parse('block', parser('\'name\', items: ["x"].y'), stubParser),
      ).toThrow();
    });

    it('rejects a 2D array with a leading nested array', () => {
      expect(() => blockTag.parse('block', parser("'name', items: [[1,2],3]"), stubParser)).toThrow(
        LiquidHTMLASTParsingError,
      );
    });

    it('rejects a 2D array with a trailing nested array', () => {
      expect(() => blockTag.parse('block', parser("'name', items: [1,[2,3]]"), stubParser)).toThrow(
        LiquidHTMLASTParsingError,
      );
    });

    it('throws on [[1]] (nested array, parity with Ruby)', () => {
      expect(() => blockTag.parse('block', parser("'name', items: [[1]]"), stubParser)).toThrow(
        LiquidHTMLASTParsingError,
      );
    });

    it('throws on an unterminated array literal', () => {
      expect(() => blockTag.parse('block', parser("'name', items: ['a'"), stubParser)).toThrow();
    });
  });

  it('parses block with a trailing comma and no args', () => {
    const result = blockTag.parse('block', parser("'name',"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.BlockMarkup,
      name: { type: NodeTypes.String, value: 'name' },
      args: [],
    });
  });

  it('parses private block names', () => {
    const result = blockTag.parse('block', parser("'_private_hero'"), stubParser);
    expect(result.name.value).toBe('_private_hero');
  });

  it('rejects a missing block type', () => {
    expect(() => blockTag.parse('block', parser(''), stubParser)).toThrow(
      "in 'block' - missing block type",
    );
  });

  it('rejects an unquoted block type', () => {
    expect(() => blockTag.parse('block', parser('card'), stubParser)).toThrow(
      "in 'block' - file name must be a string literal",
    );
  });

  it('rejects invalid block type names', () => {
    expect(() => blockTag.parse('block', parser("'foo/bar'"), stubParser)).toThrow(
      "in 'block' - 'foo/bar' is not a valid block type",
    );
    expect(() => blockTag.parse('block', parser("'-card'"), stubParser)).toThrow(
      "in 'block' - '-card' is not a valid block type",
    );
  });

  it('rejects markup without a comma before args', () => {
    expect(() => blockTag.parse('block', parser("'name' key: value"), stubParser)).toThrow(
      "Unexpected token in 'block' tag: key",
    );
  });
});
