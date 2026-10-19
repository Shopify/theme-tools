import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST } from '../ast';
import { ParserBase } from './base';
import { TokenType, tokenize } from './tokenizer';
import { sourceAt } from './test-helpers';

function parserFor(source: string): ParserBase {
  return new ParserBase(tokenize(source), source);
}

describe('Unit: ParserBase', () => {
  describe('seekToSourceOffset', () => {
    // Token starts: 0 1 2 3 4 5 7 8, then EndOfInput at 9.
    const source = 'a<p>b</p>';

    it.each([
      ['the start of the source', 0, 0],
      ['the start of a token', 5, 5],
      ['the middle of a token', 6, 6],
      ['the end of the source', 9, 8],
      ['past the end of the source', 10, 9],
    ])('lands on the first token at or after %s', (_, offset, expected) => {
      const parser = parserFor(source);
      parser.seekToSourceOffset(offset);
      expect(parser.getPosition()).to.equal(expected);
    });
  });

  describe('resliceTokensFrom', () => {
    it('only moves the cursor when the boundary falls between tokens', () => {
      const parser = parserFor('a<p>b</p>');
      parser.resliceTokensFrom(4);
      expect(parser.getPosition()).to.equal(4);
      expect(parser.tokenCount()).to.equal(9);
    });

    it('re-tokenizes from the boundary when a token straddles it', () => {
      // The stray `{{` makes one Text token run from 14 past the `{% endraw %}` end at 29.
      const parser = parserFor('{% raw %} x {{ y {% endraw %}{{ 1 }}');
      parser.resliceTokensFrom(29);
      expect(parser.getPosition()).to.equal(5);
      expect(parser.peek()).to.eql({
        type: TokenType.LiquidVariableOutputOpen,
        start: 29,
        end: 31,
      });
    });
  });

  it('parses every raw block in a document with many of them', () => {
    const parts = [
      '<!-- c -->',
      '{% comment %}c{% endcomment %}',
      '<script>x</script>',
      '{% raw %}{{ y }}{% endraw %}',
      '{{ 1 }}',
    ];
    const types = [
      'HtmlComment',
      'LiquidRawTag',
      'HtmlRawNode',
      'LiquidRawTag',
      'LiquidVariableOutput',
    ];
    const source = parts.join('').repeat(500);

    const ast = toLiquidHtmlAST(source);

    const expected = Array.from({ length: 2500 }, (_, i) => [types[i % 5], parts[i % 5]]);
    expect(ast.children.map((child) => [child.type, sourceAt(source, child.position)])).to.eql(
      expected,
    );
  });
});
