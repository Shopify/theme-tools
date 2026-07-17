import { describe, expect, it } from 'vitest';
import { tokenizeMarkup, MarkupTokenType } from './tokenizer';
import { MarkupParser } from './parser';
import { NodeTypes, Comparators } from '../types';
import { LiquidHTMLASTParsingError } from '../errors';
import type {
  LiquidConditionalExpression,
  LiquidComparison,
  LiquidLogicalExpression,
  LiquidVariableLookup,
  LiquidBooleanExpression,
  LiquidNamedArgument,
} from '../ast';

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup), markup);
}

describe('Unit: MarkupParser primitives', () => {
  describe('consume', () => {
    it('returns the token and advances on match', () => {
      const p = parser('product');
      const token = p.consume(MarkupTokenType.Id);
      expect(token).toMatchObject({ type: MarkupTokenType.Id, value: 'product' });
    });

    it('throws on type mismatch', () => {
      const p = parser('product');
      expect(() => p.consume(MarkupTokenType.Number)).toThrow(
        'Expected Number but found Id (product)',
      );
    });

    it('advances past consumed token so next consume sees next token', () => {
      const p = parser('a.b');
      p.consume(MarkupTokenType.Id);
      const dot = p.consume(MarkupTokenType.Dot);
      expect(dot).toMatchObject({ type: MarkupTokenType.Dot, value: '.' });
      const b = p.consume(MarkupTokenType.Id);
      expect(b).toMatchObject({ type: MarkupTokenType.Id, value: 'b' });
    });
  });

  describe('consumeOptional', () => {
    it('returns the token and advances on match', () => {
      const p = parser('product');
      const token = p.consumeOptional(MarkupTokenType.Id);
      expect(token).toMatchObject({ type: MarkupTokenType.Id, value: 'product' });
      expect(p.isAtEnd()).toBe(true);
    });

    it('returns null and does not advance on mismatch', () => {
      const p = parser('product');
      const result = p.consumeOptional(MarkupTokenType.Number);
      expect(result).toBeNull();
      expect(p.peek()).toMatchObject({ type: MarkupTokenType.Id, value: 'product' });
    });
  });

  describe('look', () => {
    it('returns true when current token matches type', () => {
      const p = parser('product');
      expect(p.look(MarkupTokenType.Id)).toBe(true);
    });

    it('returns false when current token does not match type', () => {
      const p = parser('product');
      expect(p.look(MarkupTokenType.Number)).toBe(false);
    });

    it('returns true when token at ahead offset matches type', () => {
      const p = parser('a.b');
      expect(p.look(MarkupTokenType.Dot, 1)).toBe(true);
    });

    it('returns false when ahead is out of bounds', () => {
      const p = parser('a');
      expect(p.look(MarkupTokenType.Id, 100)).toBe(false);
    });

    it('does not advance the pointer', () => {
      const p = parser('product');
      p.look(MarkupTokenType.Id);
      p.look(MarkupTokenType.Id, 0);
      expect(p.peek()).toMatchObject({ type: MarkupTokenType.Id, value: 'product' });
    });
  });

  describe('peek', () => {
    it('returns current token without advancing', () => {
      const p = parser('product');
      const first = p.peek();
      const second = p.peek();
      expect(first).toBe(second);
      expect(first).toMatchObject({ type: MarkupTokenType.Id, value: 'product' });
    });

    it('returns EndOfString token at end of input', () => {
      const p = parser('');
      expect(p.peek()).toMatchObject({ type: MarkupTokenType.EndOfString });
    });
  });

  describe('id', () => {
    it('consumes and returns true when current token is Id with matching value', () => {
      const p = parser('reversed');
      expect(p.id('reversed')).toBe(true);
      expect(p.isAtEnd()).toBe(true);
    });

    it('returns false and does not advance when value does not match', () => {
      const p = parser('product');
      expect(p.id('reversed')).toBe(false);
      expect(p.peek()).toMatchObject({ type: MarkupTokenType.Id, value: 'product' });
    });

    it('returns false and does not advance when token is not Id type', () => {
      const p = parser('42');
      expect(p.id('42')).toBe(false);
      expect(p.peek()).toMatchObject({ type: MarkupTokenType.Number, value: '42' });
    });
  });

  describe('isAtEnd', () => {
    it('returns false when tokens remain', () => {
      const p = parser('product');
      expect(p.isAtEnd()).toBe(false);
    });

    it('returns true at EndOfString', () => {
      const p = parser('x');
      p.consume(MarkupTokenType.Id);
      expect(p.isAtEnd()).toBe(true);
    });

    it('returns true for empty markup', () => {
      const p = parser('');
      expect(p.isAtEnd()).toBe(true);
    });
  });
});

describe('Unit: MarkupParser expression parsing', () => {
  describe('valueExpression()', () => {
    describe('strings', () => {
      it('parses single-quoted strings', () => {
        const result = parser("'hello'").valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.String,
          single: true,
          value: 'hello',
        });
      });

      it('parses double-quoted strings', () => {
        const result = parser('"world"').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.String,
          single: false,
          value: 'world',
        });
      });

      it('parses empty single-quoted strings', () => {
        const result = parser("''").valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.String,
          single: true,
          value: '',
        });
      });

      it('parses empty double-quoted strings', () => {
        const result = parser('""').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.String,
          single: false,
          value: '',
        });
      });
    });

    describe('numbers', () => {
      it('parses integers', () => {
        const result = parser('42').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.Number,
          value: '42',
        });
      });

      it('parses floats', () => {
        const result = parser('1.5').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.Number,
          value: '1.5',
        });
      });

      it('parses negative numbers', () => {
        const result = parser('-5').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.Number,
          value: '-5',
        });
      });

      it('parses underscore-separated numbers', () => {
        const result = parser('100_000').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.Number,
          value: '100_000',
        });
      });
    });

    describe('literals', () => {
      it('parses nil', () => {
        const result = parser('nil').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.LiquidLiteral,
          keyword: 'nil',
          value: null,
        });
      });

      it('parses null', () => {
        const result = parser('null').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.LiquidLiteral,
          keyword: 'null',
          value: null,
        });
      });

      it('parses true', () => {
        const result = parser('true').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.LiquidLiteral,
          keyword: 'true',
          value: true,
        });
      });

      it('parses false', () => {
        const result = parser('false').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.LiquidLiteral,
          keyword: 'false',
          value: false,
        });
      });

      it('parses blank', () => {
        const result = parser('blank').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.LiquidLiteral,
          keyword: 'blank',
          value: '',
        });
      });

      it('parses empty', () => {
        const result = parser('empty').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.LiquidLiteral,
          keyword: 'empty',
          value: '',
        });
      });
    });

    describe('variable lookups', () => {
      it('parses simple identifiers', () => {
        const result = parser('product').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'product',
          lookups: [],
        });
      });

      it('parses dotted lookups', () => {
        const result = parser('product.title').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'product',
          lookups: [{ type: NodeTypes.String, value: 'title' }],
        });
      });

      it('parses bracket lookups with numbers', () => {
        const result = parser('products[0]').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'products',
          lookups: [{ type: NodeTypes.Number, value: '0' }],
        });
      });

      it('parses mixed dot and bracket lookups', () => {
        const result = parser('product.variants[0].title').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'product',
          lookups: [
            { type: NodeTypes.String, value: 'variants' },
            { type: NodeTypes.Number, value: '0' },
            { type: NodeTypes.String, value: 'title' },
          ],
        });
      });

      it('records per-segment lookupModes (bareword vs subscript) (#2856)', () => {
        const result = parser('product.variants[0]["first"].title').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'product',
          lookupModes: ['bareword', 'subscript', 'subscript', 'bareword'],
        });
      });

      it('parses unnamed lookups (global access)', () => {
        const result = parser('["product"]').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: null,
          lookups: [{ type: NodeTypes.String, value: 'product' }],
        });
      });

      it('parses unnamed lookups with further dot lookups', () => {
        const result = parser('["x"].y').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: null,
          lookups: [
            { type: NodeTypes.String, value: 'x' },
            { type: NodeTypes.String, value: 'y' },
          ],
        });
      });

      it('parses hyphenated identifiers after dot', () => {
        const result = parser('page.about-us').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'page',
          lookups: [{ type: NodeTypes.String, value: 'about-us' }],
        });
      });

      it('parses contains after dot as variable lookup (not comparison)', () => {
        const result = parser('product.contains').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'product',
          lookups: [{ type: NodeTypes.String, value: 'contains' }],
        });
      });

      it('parses bracket lookups with variable expressions', () => {
        const result = parser('x[y]').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'x',
          lookups: [{ type: NodeTypes.VariableLookup, name: 'y', lookups: [] }],
        });
      });

      it('parses bracket lookups with nested dotted variables', () => {
        const result = parser('x[y.z]').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: 'x',
          lookups: [
            {
              type: NodeTypes.VariableLookup,
              name: 'y',
              lookups: [{ type: NodeTypes.String, value: 'z' }],
            },
          ],
        });
      });
    });

    describe('ranges', () => {
      it('parses simple numeric ranges', () => {
        const result = parser('(1..5)').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.Range,
          start: { type: NodeTypes.Number, value: '1' },
          end: { type: NodeTypes.Number, value: '5' },
        });
      });

      it('parses ranges with variable expressions', () => {
        const result = parser('(1..items.size)').valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.Range,
          start: { type: NodeTypes.Number, value: '1' },
          end: {
            type: NodeTypes.VariableLookup,
            name: 'items',
            lookups: [{ type: NodeTypes.String, value: 'size' }],
          },
        });
      });
    });

    describe('array literals are block-only (shared is array-unaware)', () => {
      it("does NOT parse ['a', 'b'] as an Array node outside a block", () => {
        expect(() => parser("['a', 'b']").valueExpression()).toThrow(LiquidHTMLASTParsingError);
      });

      it('does NOT parse [1, 2] as an Array node outside a block', () => {
        expect(() => parser('[1, 2]').valueExpression()).toThrow(LiquidHTMLASTParsingError);
      });

      it('parses a single bracketed string as a lookup, not an Array', () => {
        const result = parser("['product']").valueExpression();
        expect(result).toMatchObject({
          type: NodeTypes.VariableLookup,
          name: null,
          lookups: [{ type: NodeTypes.String, value: 'product' }],
        });
        expect(result.type).not.toBe('BlockArrayLiteral');
      });
    });

    describe('positions', () => {
      it('tracks positions for string expressions', () => {
        const result = parser("'hello'").valueExpression();
        expect(result.position).toEqual({ start: 0, end: 7 });
      });

      it('tracks positions for number expressions', () => {
        const result = parser('42').valueExpression();
        expect(result.position).toEqual({ start: 0, end: 2 });
      });

      it('tracks positions for literal expressions', () => {
        const result = parser('true').valueExpression();
        expect(result.position).toEqual({ start: 0, end: 4 });
      });

      it('tracks positions for variable lookups with dot access', () => {
        const result = parser('product.title').valueExpression();
        expect(result.position).toEqual({ start: 0, end: 13 });
      });

      it('tracks positions for variable lookups with bracket access', () => {
        const result = parser('x[0]').valueExpression();
        expect(result.position).toEqual({ start: 0, end: 4 });
      });

      it('tracks positions for range expressions', () => {
        const result = parser('(1..5)').valueExpression();
        expect(result.position).toEqual({ start: 0, end: 6 });
      });

      it('tracks nested lookup positions', () => {
        const result = parser('product.title').valueExpression();
        expect(result.type).toBe(NodeTypes.VariableLookup);
        if (result.type === NodeTypes.VariableLookup) {
          expect(result.lookups[0].position).toEqual({ start: 8, end: 13 });
        }
      });

      it('respects startOffset for document-relative positions', () => {
        const markup = 'product.title';
        const tokens = tokenizeMarkup(markup, 10);
        const p = new MarkupParser(tokens, markup);
        const result = p.valueExpression();
        expect(result.position).toEqual({ start: 10, end: 23 });
      });
    });

    describe('error handling', () => {
      it('throws on unexpected token type (pipe)', () => {
        expect(() => parser('|').valueExpression()).toThrow();
      });

      it('throws on empty input (EndOfString)', () => {
        expect(() => parser('').valueExpression()).toThrow();
      });
    });
  });
});

function parseLogical(markup: string): LiquidConditionalExpression {
  const source = `{% if ${markup} %}`;
  const offset = 6; // "{% if ".length
  const tokens = tokenizeMarkup(markup, offset);
  const p = new MarkupParser(tokens, source);
  return p.conditionalExpression();
}

function isComparison(node: LiquidConditionalExpression): node is LiquidComparison {
  return node.type === NodeTypes.Comparison;
}

function isLogical(node: LiquidConditionalExpression): node is LiquidLogicalExpression {
  return node.type === NodeTypes.LogicalExpression;
}

describe('Unit: MarkupParser.logicalExpr', () => {
  describe('comparison operators', () => {
    it('parses a == b', () => {
      const result = parseLogical('a == b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.EQUAL);
      expect((result.left as LiquidVariableLookup).name).toBe('a');
      expect((result.right as LiquidVariableLookup).name).toBe('b');
    });

    it('parses a != b', () => {
      const result = parseLogical('a != b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.NOT_EQUAL);
    });

    it('parses a > b', () => {
      const result = parseLogical('a > b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.GREATER_THAN);
    });

    it('parses a < b', () => {
      const result = parseLogical('a < b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.LESS_THAN);
    });

    it('parses a >= b', () => {
      const result = parseLogical('a >= b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.GREATER_THAN_OR_EQUAL);
    });

    it('parses a <= b', () => {
      const result = parseLogical('a <= b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.LESS_THAN_OR_EQUAL);
    });

    it('parses a contains b', () => {
      const result = parseLogical('a contains b');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.CONTAINS);
    });

    it('parses comparison with string literal', () => {
      const result = parseLogical("x == 'hello'");
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.EQUAL);
      expect((result.left as LiquidVariableLookup).name).toBe('x');
      expect(result.right.type).toBe(NodeTypes.String);
    });

    it('parses comparison with number literal', () => {
      const result = parseLogical('count > 5');
      expect(isComparison(result)).toBe(true);
      if (!isComparison(result)) return;
      expect(result.comparator).toBe(Comparators.GREATER_THAN);
      expect((result.left as LiquidVariableLookup).name).toBe('count');
      expect(result.right.type).toBe(NodeTypes.Number);
    });
  });

  describe('passthrough', () => {
    it('returns LiquidVariableLookup directly for a plain expression', () => {
      const result = parseLogical('product.title');
      expect(result.type).toBe(NodeTypes.VariableLookup);
      expect((result as LiquidVariableLookup).name).toBe('product');
    });
  });

  describe('logical operators', () => {
    it('parses a and b', () => {
      const result = parseLogical('a and b');
      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;
      expect(result.relation).toBe('and');
      expect((result.left as LiquidVariableLookup).name).toBe('a');
      expect((result.right as LiquidVariableLookup).name).toBe('b');
    });

    it('parses a or b', () => {
      const result = parseLogical('a or b');
      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;
      expect(result.relation).toBe('or');
    });
  });

  describe('RTL associativity', () => {
    it('parses a and b or c as and(a, or(b, c))', () => {
      const result = parseLogical('a and b or c');
      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;
      expect(result.relation).toBe('and');
      expect((result.left as LiquidVariableLookup).name).toBe('a');

      const right = result.right;
      expect(isLogical(right)).toBe(true);
      if (!isLogical(right)) return;
      expect(right.relation).toBe('or');
      expect((right.left as LiquidVariableLookup).name).toBe('b');
      expect((right.right as LiquidVariableLookup).name).toBe('c');
    });

    it('parses a or b or c as or(a, or(b, c))', () => {
      const result = parseLogical('a or b or c');
      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;
      expect(result.relation).toBe('or');
      expect((result.left as LiquidVariableLookup).name).toBe('a');

      const right = result.right;
      expect(isLogical(right)).toBe(true);
      if (!isLogical(right)) return;
      expect(right.relation).toBe('or');
      expect((right.left as LiquidVariableLookup).name).toBe('b');
      expect((right.right as LiquidVariableLookup).name).toBe('c');
    });

    it('parses a and b and c or d as and(a, and(b, or(c, d)))', () => {
      const result = parseLogical('a and b and c or d');
      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;
      expect(result.relation).toBe('and');
      expect((result.left as LiquidVariableLookup).name).toBe('a');

      const mid = result.right;
      expect(isLogical(mid)).toBe(true);
      if (!isLogical(mid)) return;
      expect(mid.relation).toBe('and');
      expect((mid.left as LiquidVariableLookup).name).toBe('b');

      const inner = mid.right;
      expect(isLogical(inner)).toBe(true);
      if (!isLogical(inner)) return;
      expect(inner.relation).toBe('or');
      expect((inner.left as LiquidVariableLookup).name).toBe('c');
      expect((inner.right as LiquidVariableLookup).name).toBe('d');
    });
  });

  describe('logical with comparisons', () => {
    it("parses a > 1 and b == 'x'", () => {
      const result = parseLogical("a > 1 and b == 'x'");
      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;
      expect(result.relation).toBe('and');

      const left = result.left;
      expect(isComparison(left)).toBe(true);
      if (!isComparison(left)) return;
      expect(left.comparator).toBe(Comparators.GREATER_THAN);
      expect((left.left as LiquidVariableLookup).name).toBe('a');
      expect(left.right.type).toBe(NodeTypes.Number);

      const right = result.right;
      expect(isComparison(right)).toBe(true);
      if (!isComparison(right)) return;
      expect(right.comparator).toBe(Comparators.EQUAL);
      expect((right.left as LiquidVariableLookup).name).toBe('b');
      expect(right.right.type).toBe(NodeTypes.String);
    });
  });

  describe('position tracking', () => {
    it('positions span from leftmost to rightmost token with offset', () => {
      const markup = 'a == b';
      const source = `{% if ${markup} %}`;
      const offset = 6;
      const tokens = tokenizeMarkup(markup, offset);
      const p = new MarkupParser(tokens, source);
      const result = p.conditionalExpression();

      expect(isComparison(result)).toBe(true);
      const cmp = result as LiquidComparison;

      // 'a' starts at offset 6, 'b' ends at offset 12
      expect(cmp.position.start).toBe(6);
      expect(cmp.position.end).toBe(12);

      // left 'a' position
      expect(cmp.left.position.start).toBe(6);
      expect(cmp.left.position.end).toBe(7);

      // right 'b' position
      expect(cmp.right.position.start).toBe(11);
      expect(cmp.right.position.end).toBe(12);
    });

    it('positions span correctly for logical expressions', () => {
      const markup = 'a and b';
      const source = `{% if ${markup} %}`;
      const offset = 6;
      const tokens = tokenizeMarkup(markup, offset);
      const p = new MarkupParser(tokens, source);
      const result = p.conditionalExpression();

      expect(isLogical(result)).toBe(true);
      if (!isLogical(result)) return;

      // 'a' starts at 6, 'b' ends at 13
      expect(result.position.start).toBe(6);
      expect(result.position.end).toBe(13);
    });
  });
});

describe('Unit: MarkupParser entry points', () => {
  describe('conditionalExpression()', () => {
    it('passes through a plain expression as LiquidExpression', () => {
      const result = parser('product.title').conditionalExpression();
      expect(result.type).toBe(NodeTypes.VariableLookup);
    });

    it('returns LiquidComparison for comparison expressions', () => {
      const result = parser('a == b').conditionalExpression();
      expect(result.type).toBe(NodeTypes.Comparison);
    });

    it('returns LiquidLogicalExpression for logical expressions', () => {
      const result = parser('a and b').conditionalExpression();
      expect(result.type).toBe(NodeTypes.LogicalExpression);
    });

    it('parses full chain: a > 1 and b == "x"', () => {
      const result = parser("a > 1 and b == 'x'").conditionalExpression();
      expect(isLogical(result)).toBe(true);
      const log = result as LiquidLogicalExpression;
      expect(log.relation).toBe('and');
      expect(isComparison(log.left)).toBe(true);
      expect(isComparison(log.right)).toBe(true);
    });
  });

  describe('expression()', () => {
    it('returns plain LiquidExpression unwrapped for simple variables', () => {
      const result = parser('product').expression();
      expect(result.type).toBe(NodeTypes.VariableLookup);
    });

    it('returns plain LiquidExpression unwrapped for string literals', () => {
      const result = parser("'hello'").expression();
      expect(result.type).toBe(NodeTypes.String);
    });

    it('returns plain LiquidExpression unwrapped for number literals', () => {
      const result = parser('42').expression();
      expect(result.type).toBe(NodeTypes.Number);
    });

    it('wraps comparison in LiquidBooleanExpression', () => {
      const result = parser('a == b').expression();
      expect(result.type).toBe(NodeTypes.BooleanExpression);
      if (result.type !== NodeTypes.BooleanExpression) return;
      const bool = result as LiquidBooleanExpression;
      expect(bool.condition.type).toBe(NodeTypes.Comparison);
    });

    it('wraps logical expression in LiquidBooleanExpression', () => {
      const result = parser('a and b').expression();
      expect(result.type).toBe(NodeTypes.BooleanExpression);
      if (result.type !== NodeTypes.BooleanExpression) return;
      const bool = result as LiquidBooleanExpression;
      expect(bool.condition.type).toBe(NodeTypes.LogicalExpression);
    });

    it('preserves position from inner expression when wrapping', () => {
      const markup = 'a == b';
      const tokens = tokenizeMarkup(markup, 10);
      const p = new MarkupParser(tokens, markup);
      const result = p.expression();
      expect(result.type).toBe(NodeTypes.BooleanExpression);
      expect(result.position).toEqual({ start: 10, end: 16 });
    });

    it('does not wrap literal keywords (nil, true, false)', () => {
      expect(parser('nil').expression().type).toBe(NodeTypes.LiquidLiteral);
      expect(parser('true').expression().type).toBe(NodeTypes.LiquidLiteral);
      expect(parser('false').expression().type).toBe(NodeTypes.LiquidLiteral);
    });
  });
});

describe('Unit: MarkupParser structured primitives', () => {
  describe('liquidVariable()', () => {
    it('parses simple expression with no filters', () => {
      const result = parser('product.title').liquidVariable();
      expect(result.type).toBe(NodeTypes.LiquidVariable);
      expect(result.expression).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'product',
      });
      expect(result.filters).toEqual([]);
    });

    it('parses expression with one filter', () => {
      const result = parser('product.title | upcase').liquidVariable();
      expect(result.expression).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'product',
      });
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toMatchObject({
        type: NodeTypes.LiquidFilter,
        name: 'upcase',
        args: [],
      });
    });

    it('parses expression with filter with args', () => {
      const result = parser("price | money_with_currency: 'USD'").liquidVariable();
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].name).toBe('money_with_currency');
      expect(result.filters[0].args).toHaveLength(1);
      expect(result.filters[0].args[0]).toMatchObject({
        type: NodeTypes.String,
        value: 'USD',
      });
    });

    it('parses expression with chained filters', () => {
      const result = parser('name | downcase | truncate: 10').liquidVariable();
      expect(result.filters).toHaveLength(2);
      expect(result.filters[0]).toMatchObject({ name: 'downcase', args: [] });
      expect(result.filters[1]).toMatchObject({ name: 'truncate' });
      expect(result.filters[1].args).toHaveLength(1);
      expect(result.filters[1].args[0]).toMatchObject({
        type: NodeTypes.Number,
        value: '10',
      });
    });

    it('parses expression with filter with named args', () => {
      const result = parser("items | where: attribute: 'color', value: 'red'").liquidVariable();
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].args).toHaveLength(2);
      expect(result.filters[0].args[0]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'attribute',
      });
      expect(result.filters[0].args[1]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'value',
      });
    });

    it('parses expression with filter with mixed args', () => {
      const result = parser("product | default: 'N/A', allow_false: true").liquidVariable();
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0].args).toHaveLength(2);
      expect(result.filters[0].args[0]).toMatchObject({
        type: NodeTypes.String,
        value: 'N/A',
      });
      expect(result.filters[0].args[1]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'allow_false',
      });
    });

    it('rawSource matches source slice', () => {
      const markup = 'product | upcase';
      const result = parser(markup).liquidVariable();
      expect(result.rawSource).toBe(markup);
    });

    it('rawSource with startOffset', () => {
      const markup = 'product | upcase';
      const source = `{{ ${markup} }}`;
      const tokens = tokenizeMarkup(markup, 3);
      const p = new MarkupParser(tokens, source);
      const result = p.liquidVariable();
      expect(result.rawSource).toBe('product | upcase');
    });

    it('position spans from expression to end of last filter', () => {
      const markup = 'product | upcase';
      const result = parser(markup).liquidVariable();
      expect(result.position).toEqual({ start: 0, end: 16 });
    });

    it('position with no filters matches expression position', () => {
      const result = parser('product').liquidVariable();
      expect(result.position).toEqual({ start: 0, end: 7 });
    });
  });

  describe('filters()', () => {
    it('parses filter with no args', () => {
      const p = parser('x | upcase');
      p.expression(); // consume the expression first
      const result = p.filters(1); // previousEnd = after 'x'
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: NodeTypes.LiquidFilter,
        name: 'upcase',
        args: [],
      });
    });

    it('parses filter with positional args', () => {
      const p = parser("x | truncate: 10, '...'");
      p.expression();
      const result = p.filters(1);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('truncate');
      expect(result[0].args).toHaveLength(2);
      expect(result[0].args[0]).toMatchObject({ type: NodeTypes.Number, value: '10' });
      expect(result[0].args[1]).toMatchObject({ type: NodeTypes.String, value: '...' });
    });

    it('parses filter with named args', () => {
      const p = parser("x | where: attribute: 'color'");
      p.expression();
      const result = p.filters(1);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('where');
      expect(result[0].args).toHaveLength(1);
      expect(result[0].args[0]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'attribute',
      });
    });

    it('filter positions are contiguous from previous end', () => {
      const p = parser('x | truncate: 10');
      p.expression();
      const result = p.filters(1);
      expect(result[0].position.start).toBe(1);
      expect(result[0].position.end).toBe(16);
    });

    it('position for filter with no args starts at previous end', () => {
      const p = parser('x | upcase');
      p.expression();
      const result = p.filters(1);
      expect(result[0].position.start).toBe(1);
      expect(result[0].position.end).toBe(10);
    });

    it('chained filter positions are contiguous', () => {
      const p = parser("x | replace: '_', '-' | upcase");
      p.expression();
      const result = p.filters(1);
      expect(result).toHaveLength(2);
      expect(result[0].position.start).toBe(1);
      expect(result[0].position.end).toBe(21);
      expect(result[1].position.start).toBe(21);
      expect(result[1].position.end).toBe(30);
    });
  });

  describe('argument()', () => {
    it('parses positional argument (expression)', () => {
      const result = parser('product').argument();
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'product',
      });
    });

    it('parses named argument', () => {
      const result = parser('limit: 10').argument();
      expect(result).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'limit',
      });
      if (result.type === NodeTypes.NamedArgument) {
        expect((result as LiquidNamedArgument).value).toMatchObject({
          type: NodeTypes.Number,
          value: '10',
        });
      }
    });
  });

  describe('namedArgument()', () => {
    it('parses basic named argument', () => {
      const result = parser('limit: 10').namedArgument();
      expect(result).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'limit',
      });
      expect(result.value).toMatchObject({
        type: NodeTypes.Number,
        value: '10',
      });
    });

    it('parses named argument with string value', () => {
      const result = parser("class: 'active'").namedArgument();
      expect(result).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'class',
      });
      expect(result.value).toMatchObject({
        type: NodeTypes.String,
        value: 'active',
      });
    });

    it('position spans from name to end of value', () => {
      const result = parser('limit: 10').namedArgument();
      expect(result.position).toEqual({ start: 0, end: 9 });
    });
  });

  describe('arguments()', () => {
    it('parses single positional arg', () => {
      const result = parser('product').arguments();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'product',
      });
    });

    it('parses multiple positional args', () => {
      const result = parser("product, 10, 'hello'").arguments();
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ type: NodeTypes.VariableLookup });
      expect(result[1]).toMatchObject({ type: NodeTypes.Number, value: '10' });
      expect(result[2]).toMatchObject({ type: NodeTypes.String, value: 'hello' });
    });

    it('parses mixed positional and named args', () => {
      const result = parser('product, limit: 10').arguments();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: NodeTypes.VariableLookup });
      expect(result[1]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'limit',
      });
    });
  });

  describe('namedArguments()', () => {
    it('parses single named arg', () => {
      const result = parser('limit: 10').namedArguments();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: NodeTypes.NamedArgument,
        name: 'limit',
      });
    });

    it('parses multiple named args', () => {
      const result = parser('limit: 10, offset: 5').namedArguments();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: NodeTypes.NamedArgument, name: 'limit' });
      expect(result[1]).toMatchObject({ type: NodeTypes.NamedArgument, name: 'offset' });
    });
  });
});

// Lax condition parsing preserves an unknown operator so the engine can raise
// `Unknown operator <op>` at evaluate time. The operator string is carried
// verbatim in the Comparison node's `comparator` field (outside the
// Comparators enum).
function parseLaxCondition(markup: string): LiquidConditionalExpression {
  const source = `{% if ${markup} %}`;
  const offset = 6; // "{% if ".length
  const tokens = tokenizeMarkup(markup, offset);
  const p = new MarkupParser(tokens, source).enableLax();
  return p.conditionalExpression();
}

describe('Unit: MarkupParser lax unknown-operator conditions', () => {
  it('preserves `=` (Equality token that is not ==) as the comparator', () => {
    const result = parseLaxCondition('0 = 0');
    expect(result.type).toBe(NodeTypes.Comparison);
    if (result.type !== NodeTypes.Comparison) return;
    // `=` is outside the Comparators enum; it is preserved verbatim.
    expect((result as LiquidComparison).comparator).toBe('=');
  });

  it('preserves a bare word (`true true`) as the comparator', () => {
    const result = parseLaxCondition('true true');
    expect(result.type).toBe(NodeTypes.Comparison);
    if (result.type !== NodeTypes.Comparison) return;
    expect((result as LiquidComparison).comparator).toBe('true');
  });

  it('preserves a bare word when the left operand is a lookup (`a true`)', () => {
    const result = parseLaxCondition('a true');
    expect(result.type).toBe(NodeTypes.Comparison);
    if (result.type !== NodeTypes.Comparison) return;
    expect((result as LiquidComparison).comparator).toBe('true');
  });

  it('does NOT treat words separated by dropped chars as an operator (`true && false`)', () => {
    // `&&` is dropped by the tokenizer; the gap between the two words is not
    // whitespace-only, so Ruby's contiguous `[=!<>a-z_]+` match would not span
    // it. Lax eats the rest of the logic, leaving the bare left operand.
    const result = parseLaxCondition('true && false');
    expect(result.type).not.toBe(NodeTypes.Comparison);
  });

  it('known operators still parse normally in lax mode (`a == b`)', () => {
    const result = parseLaxCondition('a == b');
    expect(result.type).toBe(NodeTypes.Comparison);
    if (result.type !== NodeTypes.Comparison) return;
    expect((result as LiquidComparison).comparator).toBe(Comparators.EQUAL);
  });

  it('does NOT fold contiguous comparison operators into a lookup in a condition (`foo==bar baz`)', () => {
    // Regression: the lax QuotedFragment lookup-folding that recovers
    // `when foo=>bar` -> `foo["bar"]` is a VALUE-context behavior and must NOT
    // fire in a CONDITION. The guard verified here is exactly that: for
    // `foo==bar baz` the condition is parsed as a comparison carrying an
    // unknown operator, NOT as a folded variable lookup `foo["bar"]` (which
    // would silently collapse the condition to left-truthiness). The left
    // operand's lookups must stay empty — no `=>`-style fold occurred.
    //
    // This intentionally does NOT assert the exact left/operator decomposition.
    // Ruby's lax condition Syntax (`if.rb:17`) splits on QuotedFragment
    // (`[^\s,\|'"]+`), so the contiguous run binds the LEFT operand to
    // `foo==bar` and takes the space-separated `baz` as the (unknown) operator.
    // This parser instead captures `==bar` as the operator run. That
    // exact-decomposition mismatch is a separate, pre-existing
    // lax-unknown-operator-condition parity gap tracked against issue 851512; it
    // is left un-asserted here so it stays visible as a tracked defect rather
    // than masked. This guard only verifies the no-fold-in-condition invariant,
    // which both decompositions satisfy.
    const result = parseLaxCondition('foo==bar baz');
    expect(result.type).toBe(NodeTypes.Comparison);
    if (result.type !== NodeTypes.Comparison) return;
    const cmp = result as LiquidComparison;
    // An unknown operator: outside the supported comparator enum — neither a
    // normally-parsed `==` nor (crucially) a folded lookup.
    expect(Object.values(Comparators)).not.toContain(cmp.comparator);
    // Left operand is the bare `foo` variable lookup with NO folded segments:
    // the value-context `=>` fold did not leak into the condition.
    expect((cmp.left as LiquidVariableLookup).name).toBe('foo');
    expect((cmp.left as LiquidVariableLookup).lookups).toHaveLength(0);
  });

  it('value context (not a condition) does not preserve a trailing word', () => {
    // `inCondition` is false here: a bare value expression with trailing garbage
    // ends at the value (mirrors the value-context quirk `{{ false a }}` -> `false`).
    const tokens = tokenizeMarkup('false a', 0);
    const p = new MarkupParser(tokens, 'false a').enableLax();
    const result = p.comparison();
    expect('kind' in result && (result as { kind?: string }).kind).not.toBe('comparison');
  });
});
