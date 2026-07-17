import { describe, expect, it } from 'vitest';
import { tokenizeMarkup, MarkupTokenType } from './tokenizer';
import type { MarkupToken } from './tokenizer';

/** Strip the trailing EndOfString token for cleaner assertions. */
function tokens(source: string, startOffset = 0): MarkupToken[] {
  const all = tokenizeMarkup(source, startOffset);
  return all.filter((t) => t.type !== MarkupTokenType.EndOfString);
}

/**
 * Assert the slice invariant: for every non-EndOfString token,
 * token.value === markup.slice(token.start - startOffset, token.end - startOffset)
 */
function assertSliceInvariant(markup: string, startOffset = 0): void {
  const all = tokenizeMarkup(markup, startOffset);
  for (const token of all) {
    if (token.type === MarkupTokenType.EndOfString) continue;
    const sliced = markup.slice(token.start - startOffset, token.end - startOffset);
    expect(sliced).toBe(token.value);
  }
}

describe('Unit: markup-tokenizer', () => {
  describe('identifiers', () => {
    it('tokenizes a simple identifier', () => {
      expect(tokens('product')).toMatchObject([{ type: MarkupTokenType.Id, value: 'product' }]);
    });

    it('tokenizes a hyphenated identifier', () => {
      expect(tokens('my-var')).toMatchObject([{ type: MarkupTokenType.Id, value: 'my-var' }]);
    });

    it('tokenizes an identifier with trailing question mark', () => {
      expect(tokens('blank?')).toMatchObject([{ type: MarkupTokenType.Id, value: 'blank?' }]);
    });

    it('tokenizes an underscore-prefixed identifier', () => {
      expect(tokens('_private')).toMatchObject([{ type: MarkupTokenType.Id, value: '_private' }]);
    });

    it('tokenizes a mixed identifier with hyphens and underscores', () => {
      expect(tokens('x-y_z')).toMatchObject([{ type: MarkupTokenType.Id, value: 'x-y_z' }]);
    });
  });

  describe('strings', () => {
    it('tokenizes a single-quoted string including quotes', () => {
      const result = tokens("'hello'");
      expect(result).toMatchObject([{ type: MarkupTokenType.String, value: "'hello'" }]);
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(7);
    });

    it('tokenizes a double-quoted string including quotes', () => {
      const result = tokens('"world"');
      expect(result).toMatchObject([{ type: MarkupTokenType.String, value: '"world"' }]);
    });

    it('tokenizes an empty single-quoted string', () => {
      expect(tokens("''")).toMatchObject([{ type: MarkupTokenType.String, value: "''" }]);
    });

    it('tokenizes an empty double-quoted string', () => {
      expect(tokens('""')).toMatchObject([{ type: MarkupTokenType.String, value: '""' }]);
    });
  });

  describe('numbers', () => {
    it('tokenizes an integer', () => {
      expect(tokens('42')).toMatchObject([{ type: MarkupTokenType.Number, value: '42' }]);
    });

    it('tokenizes a float', () => {
      expect(tokens('1.5')).toMatchObject([{ type: MarkupTokenType.Number, value: '1.5' }]);
    });

    it('tokenizes an underscore-separated number', () => {
      expect(tokens('100_000')).toMatchObject([{ type: MarkupTokenType.Number, value: '100_000' }]);
    });

    it('tokenizes a negative integer as a single token', () => {
      const result = tokens('-5');
      expect(result).toMatchObject([{ type: MarkupTokenType.Number, value: '-5' }]);
      expect(result).toHaveLength(1);
    });

    it('tokenizes a negative float as a single token', () => {
      const result = tokens('-1.5');
      expect(result).toMatchObject([{ type: MarkupTokenType.Number, value: '-1.5' }]);
      expect(result).toHaveLength(1);
    });

    it('tokenizes a negative underscore-separated number', () => {
      const result = tokens('-100_000');
      expect(result).toMatchObject([{ type: MarkupTokenType.Number, value: '-100_000' }]);
      expect(result).toHaveLength(1);
    });
  });

  describe('operators', () => {
    it('tokenizes dot', () => {
      expect(tokens('.')).toMatchObject([{ type: MarkupTokenType.Dot, value: '.' }]);
    });

    it('tokenizes dotdot', () => {
      expect(tokens('..')).toMatchObject([{ type: MarkupTokenType.DotDot, value: '..' }]);
    });

    it('tokenizes pipe', () => {
      expect(tokens('|')).toMatchObject([{ type: MarkupTokenType.Pipe, value: '|' }]);
    });

    it('tokenizes colon', () => {
      expect(tokens(':')).toMatchObject([{ type: MarkupTokenType.Colon, value: ':' }]);
    });

    it('tokenizes comma', () => {
      expect(tokens(',')).toMatchObject([{ type: MarkupTokenType.Comma, value: ',' }]);
    });

    it('tokenizes parentheses', () => {
      expect(tokens('()')).toMatchObject([
        { type: MarkupTokenType.OpenRound, value: '(' },
        { type: MarkupTokenType.CloseRound, value: ')' },
      ]);
    });

    it('tokenizes square brackets', () => {
      expect(tokens('[]')).toMatchObject([
        { type: MarkupTokenType.OpenSquare, value: '[' },
        { type: MarkupTokenType.CloseSquare, value: ']' },
      ]);
    });

    it('tokenizes greater than', () => {
      expect(tokens('>')).toMatchObject([{ type: MarkupTokenType.Comparison, value: '>' }]);
    });

    it('tokenizes less than', () => {
      expect(tokens('<')).toMatchObject([{ type: MarkupTokenType.Comparison, value: '<' }]);
    });

    it('tokenizes greater equal', () => {
      expect(tokens('>=')).toMatchObject([{ type: MarkupTokenType.Comparison, value: '>=' }]);
    });

    it('tokenizes less equal', () => {
      expect(tokens('<=')).toMatchObject([{ type: MarkupTokenType.Comparison, value: '<=' }]);
    });

    it('tokenizes equality', () => {
      expect(tokens('==')).toMatchObject([{ type: MarkupTokenType.Equality, value: '==' }]);
    });

    it('tokenizes not equal', () => {
      expect(tokens('!=')).toMatchObject([{ type: MarkupTokenType.Equality, value: '!=' }]);
    });

    it('tokenizes standalone dash followed by identifier', () => {
      expect(tokens('- x')).toMatchObject([
        { type: MarkupTokenType.Dash, value: '-' },
        { type: MarkupTokenType.Id, value: 'x' },
      ]);
    });
  });

  describe('keyword classification', () => {
    it('classifies and as Logical', () => {
      expect(tokens('and')).toMatchObject([{ type: MarkupTokenType.Logical, value: 'and' }]);
    });

    it('classifies or as Logical', () => {
      expect(tokens('or')).toMatchObject([{ type: MarkupTokenType.Logical, value: 'or' }]);
    });

    it('classifies contains as Comparison', () => {
      expect(tokens('contains')).toMatchObject([
        { type: MarkupTokenType.Comparison, value: 'contains' },
      ]);
    });

    it('treats contains as Id after dot', () => {
      expect(tokens('product.contains')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'product' },
        { type: MarkupTokenType.Dot, value: '.' },
        { type: MarkupTokenType.Id, value: 'contains' },
      ]);
    });

    it('treats and as Id after dot', () => {
      expect(tokens('product.and')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'product' },
        { type: MarkupTokenType.Dot, value: '.' },
        { type: MarkupTokenType.Id, value: 'and' },
      ]);
    });

    it('treats or as Id after dot', () => {
      expect(tokens('product.or')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'product' },
        { type: MarkupTokenType.Dot, value: '.' },
        { type: MarkupTokenType.Id, value: 'or' },
      ]);
    });
  });

  describe('position tracking', () => {
    it('tracks positions with startOffset=0', () => {
      const result = tokenizeMarkup('product', 0);
      expect(result[0]).toMatchObject({
        type: MarkupTokenType.Id,
        value: 'product',
        start: 0,
        end: 7,
      });
    });

    it('tracks positions with startOffset=10', () => {
      const result = tokenizeMarkup('product', 10);
      expect(result[0]).toMatchObject({
        type: MarkupTokenType.Id,
        value: 'product',
        start: 10,
        end: 17,
      });
    });

    it('tracks positions across whitespace gaps', () => {
      const result = tokens('a b', 0);
      expect(result).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a', start: 0, end: 1 },
        { type: MarkupTokenType.Id, value: 'b', start: 2, end: 3 },
      ]);
    });

    it('positions EndOfString correctly with startOffset', () => {
      const result = tokenizeMarkup('x', 5);
      const eos = result.find((t) => t.type === MarkupTokenType.EndOfString)!;
      expect(eos).toMatchObject({
        type: MarkupTokenType.EndOfString,
        start: 6,
        end: 6,
      });
    });

    it('tracks positions for each token in a multi-token expression', () => {
      const result = tokens('a == b', 0);
      expect(result).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a', start: 0, end: 1 },
        { type: MarkupTokenType.Equality, value: '==', start: 2, end: 4 },
        { type: MarkupTokenType.Id, value: 'b', start: 5, end: 6 },
      ]);
    });
  });

  describe('EndOfString', () => {
    it('is always the last token', () => {
      const result = tokenizeMarkup('product', 0);
      expect(result[result.length - 1].type).toBe(MarkupTokenType.EndOfString);
    });

    it('is the only token for empty input', () => {
      const result = tokenizeMarkup('', 0);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: MarkupTokenType.EndOfString,
        value: '',
        start: 0,
        end: 0,
      });
    });

    it('has an empty string value', () => {
      const result = tokenizeMarkup('x', 0);
      const eos = result.find((t) => t.type === MarkupTokenType.EndOfString)!;
      expect(eos.value).toBe('');
    });
  });

  describe('complex expressions', () => {
    it('tokenizes a variable lookup', () => {
      expect(tokens('product.title')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'product' },
        { type: MarkupTokenType.Dot, value: '.' },
        { type: MarkupTokenType.Id, value: 'title' },
      ]);
    });

    it('tokenizes an equality expression', () => {
      expect(tokens('a == b')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a' },
        { type: MarkupTokenType.Equality, value: '==' },
        { type: MarkupTokenType.Id, value: 'b' },
      ]);
    });

    it('tokenizes a comparison expression', () => {
      expect(tokens('a > b')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a' },
        { type: MarkupTokenType.Comparison, value: '>' },
        { type: MarkupTokenType.Id, value: 'b' },
      ]);
    });

    it('tokenizes a logical chain', () => {
      expect(tokens('a and b or c')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a' },
        { type: MarkupTokenType.Logical, value: 'and' },
        { type: MarkupTokenType.Id, value: 'b' },
        { type: MarkupTokenType.Logical, value: 'or' },
        { type: MarkupTokenType.Id, value: 'c' },
      ]);
    });

    it('tokenizes a range expression', () => {
      expect(tokens('(1..5)')).toMatchObject([
        { type: MarkupTokenType.OpenRound, value: '(' },
        { type: MarkupTokenType.Number, value: '1' },
        { type: MarkupTokenType.DotDot, value: '..' },
        { type: MarkupTokenType.Number, value: '5' },
        { type: MarkupTokenType.CloseRound, value: ')' },
      ]);
    });

    it('tokenizes bracket access', () => {
      expect(tokens('products[0]')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'products' },
        { type: MarkupTokenType.OpenSquare, value: '[' },
        { type: MarkupTokenType.Number, value: '0' },
        { type: MarkupTokenType.CloseSquare, value: ']' },
      ]);
    });

    it('tokenizes a filter chain', () => {
      expect(tokens('x | filter: arg1, arg2')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'x' },
        { type: MarkupTokenType.Pipe, value: '|' },
        { type: MarkupTokenType.Id, value: 'filter' },
        { type: MarkupTokenType.Colon, value: ':' },
        { type: MarkupTokenType.Id, value: 'arg1' },
        { type: MarkupTokenType.Comma, value: ',' },
        { type: MarkupTokenType.Id, value: 'arg2' },
      ]);
    });

    it('tokenizes a negative number in an expression', () => {
      expect(tokens('a > -5')).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a' },
        { type: MarkupTokenType.Comparison, value: '>' },
        { type: MarkupTokenType.Number, value: '-5' },
      ]);
    });

    it('tokenizes a decimal followed by a range', () => {
      expect(tokens('1.5..10')).toMatchObject([
        { type: MarkupTokenType.Number, value: '1.5' },
        { type: MarkupTokenType.DotDot, value: '..' },
        { type: MarkupTokenType.Number, value: '10' },
      ]);
    });
  });

  describe('slice invariant (value === source.slice(start - offset, end - offset))', () => {
    it('holds for simple identifiers', () => {
      assertSliceInvariant('product');
    });

    it('holds for strings', () => {
      assertSliceInvariant("'hello'");
      assertSliceInvariant('"world"');
    });

    it('holds for numbers', () => {
      assertSliceInvariant('42');
      assertSliceInvariant('1.5');
      assertSliceInvariant('-5');
      assertSliceInvariant('100_000');
    });

    it('holds for operators', () => {
      assertSliceInvariant('>= <= == != ..');
    });

    it('holds with nonzero startOffset', () => {
      assertSliceInvariant('product.title', 50);
      assertSliceInvariant('a == b', 100);
      assertSliceInvariant("x | filter: 'arg', 42", 200);
    });

    it('holds for complex expressions', () => {
      assertSliceInvariant('a and b or c');
      assertSliceInvariant('(1..5)');
      assertSliceInvariant('products[0].title');
      assertSliceInvariant("x | split: ',' | first");
    });

    it('holds for keyword context-sensitivity', () => {
      assertSliceInvariant('product.contains');
      assertSliceInvariant('product.and');
    });
  });

  describe('nonzero startOffset with multi-token expressions', () => {
    it('shifts all positions in a multi-token expression', () => {
      const offset = 25;
      const result = tokens('a == b', offset);
      expect(result).toMatchObject([
        { type: MarkupTokenType.Id, value: 'a', start: 25, end: 26 },
        { type: MarkupTokenType.Equality, value: '==', start: 27, end: 29 },
        { type: MarkupTokenType.Id, value: 'b', start: 30, end: 31 },
      ]);
    });

    it('shifts positions for filter chains', () => {
      const offset = 10;
      const result = tokens('x | f: y', offset);
      expect(result).toMatchObject([
        { type: MarkupTokenType.Id, value: 'x', start: 10, end: 11 },
        { type: MarkupTokenType.Pipe, value: '|', start: 12, end: 13 },
        { type: MarkupTokenType.Id, value: 'f', start: 14, end: 15 },
        { type: MarkupTokenType.Colon, value: ':', start: 15, end: 16 },
        { type: MarkupTokenType.Id, value: 'y', start: 17, end: 18 },
      ]);
    });
  });

  describe('edge cases', () => {
    it('tokenizes three dots as DotDot + Dot', () => {
      expect(tokens('...')).toMatchObject([
        { type: MarkupTokenType.DotDot, value: '..' },
        { type: MarkupTokenType.Dot, value: '.' },
      ]);
    });

    it('tokenizes whitespace-only input as just EndOfString', () => {
      const result = tokenizeMarkup('   ', 0);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(MarkupTokenType.EndOfString);
    });
  });
});
