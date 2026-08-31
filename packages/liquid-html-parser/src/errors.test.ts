import { describe, expect, it } from 'vitest';
import { toLiquidHtmlAST } from './ast';
import { LiquidHTMLASTParsingError } from './errors';

/**
 * A parse error has to arrive as a parse error. `line-column` answers `null` for an
 * index outside the source, and the token that fails at the end of input starts at
 * `source.length` — one past the last character — so building the error used to throw
 * `TypeError: Cannot read properties of null (reading 'line')` from its own
 * constructor. A caller that wanted to catch a syntax error instead got an unrelated
 * TypeError with no position on it.
 */
describe('Unit: LiquidHTMLASTParsingError', () => {
  describe('errors at the end of input', () => {
    it('reports an unclosed variable output as a parsing error', () => {
      const source = '{{ unclosed ';

      expect(() => toLiquidHtmlAST(source)).toThrowError(LiquidHTMLASTParsingError);
    });

    it('points at the last position in the source', () => {
      const source = '{{ unclosed ';
      let thrown: LiquidHTMLASTParsingError | undefined;

      try {
        toLiquidHtmlAST(source);
      } catch (error) {
        thrown = error as LiquidHTMLASTParsingError;
      }

      expect(thrown?.name).to.eql('LiquidHTMLParsingError');
      // `col` is 1-based, so the last character of the source is `source.length`.
      expect(thrown?.loc).to.eql({
        start: { line: 1, column: source.length },
        end: { line: 1, column: source.length },
      });
    });

    it('reports the line an unclosed output starts on, not the first line', () => {
      const source = 'hello\nworld\n{{ unclosed ';
      let thrown: LiquidHTMLASTParsingError | undefined;

      try {
        toLiquidHtmlAST(source);
      } catch (error) {
        thrown = error as LiquidHTMLASTParsingError;
      }

      expect(thrown?.loc?.start.line).to.eql(3);
    });
  });

  describe('indices outside the source', () => {
    it('falls back to the document start for an empty source', () => {
      const error = new LiquidHTMLASTParsingError('boom', '', 0, 0);

      expect(error.loc).to.eql({ start: { line: 1, column: 1 }, end: { line: 1, column: 1 } });
    });

    it('clamps an index past the end of the source', () => {
      const error = new LiquidHTMLASTParsingError('boom', 'ab', 99, 99);

      expect(error.loc).to.eql({ start: { line: 1, column: 2 }, end: { line: 1, column: 2 } });
    });

    it('clamps a negative index', () => {
      const error = new LiquidHTMLASTParsingError('boom', 'ab', -5, -5);

      expect(error.loc).to.eql({ start: { line: 1, column: 1 }, end: { line: 1, column: 1 } });
    });
  });

  describe('errors inside the source', () => {
    it('keeps the reported position of an error away from the boundaries', () => {
      const source = 'line one\nline two\nline three';
      const index = source.indexOf('two');
      const error = new LiquidHTMLASTParsingError('boom', source, index, index + 2);

      expect(error.loc).to.eql({ start: { line: 2, column: 6 }, end: { line: 2, column: 8 } });
    });
  });
});
