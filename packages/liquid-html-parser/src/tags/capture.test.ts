import { describe, expect, it } from 'vitest';
import { captureTag } from './capture';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

/** A lax-recovery parser, mirroring how the render-tree re-parses a base-case
 *  capture tag via `laxRecoverTagMarkup` (`enableLax()`). */
function laxParser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup).enableLax();
}

const stubParser = {} as Parser;

describe('captureTag', () => {
  it('has block kind', () => {
    expect(captureTag.kind).toBe(TagKind.Block);
  });

  it('has no branches', () => {
    expect(captureTag.branches).toEqual([]);
  });

  it('parses a variable lookup', () => {
    const result = captureTag.parse('capture', parser('my_var'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'my_var',
      lookups: [],
    });
  });

  // ── Lax recovery: capture name via Ruby's VariableSignature scan ───────────
  // Strict parse rejects a non-identifier capture name (variableLookup() accepts
  // only Id / OpenSquare), so it arrives at the render-tree as a base-case node
  // where `laxRecoverTagMarkup` re-runs `captureTag.parse` under `enableLax()`.
  // Lax recovery mirrors Ruby `capture.rb`'s `Syntax = /(#{VariableSignature}+)/`
  // scan of the WHOLE markup: it skips a leading quote and takes the first
  // contiguous VariableSignature run as the name (#2841).
  describe('lax recovery', () => {
    it('strict parse throws on a quoted capture name (DD-7)', () => {
      // DD-7: strict `toLiquidHtmlAST` output is unchanged — `'var'` is still a
      // syntax error in strict mode, so theme-check keeps flagging it.
      expect(() => captureTag.parse('capture', parser("'var'"), stubParser)).toThrow();
    });

    it('recovers a quoted capture name as the unquoted inner identifier (#2841)', () => {
      const result = captureTag.parse('capture', laxParser("'var'"), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'var',
        lookups: [],
      });
    });

    it('recovers a double-quoted capture name', () => {
      const result = captureTag.parse('capture', laxParser('"thing"'), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'thing',
        lookups: [],
      });
    });

    it('stops the name at the first space inside a quoted target', () => {
      // Ruby's unanchored `VariableSignature+` stops at the space, so
      // `'foo bar'` captures into `foo`, not `foo bar`.
      const result = captureTag.parse('capture', laxParser("'foo bar'"), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'foo',
        lookups: [],
      });
    });

    it('stops the name at the first punctuation inside a quoted target', () => {
      // `!` is not a VariableSignature char, so `'foo!bar'` captures into `foo`.
      const result = captureTag.parse('capture', laxParser("'foo!bar'"), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'foo',
        lookups: [],
      });
    });

    it('recovers a core-tested invalid name with parens and brackets', () => {
      // Mirrors core capture_test.rb#test_capture_allows_invalid_names_in_lax:
      // `{% capture (x[y %}` captures into `(x[y` because `(`, `[` and `]` are
      // all VariableSignature chars. Not a String token, so the scan (not a
      // string-only special case) is what recovers it.
      const result = captureTag.parse('capture', laxParser('(x[y'), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: '(x[y',
        lookups: [],
      });
    });

    it('does not recover an empty quoted target', () => {
      // `''` has no VariableSignature byte, so Ruby's `markup =~ Syntax` fails
      // and raises — unrecoverable.
      expect(() => captureTag.parse('capture', laxParser("''"), stubParser)).toThrow();
    });

    it('still parses a bare identifier name under lax', () => {
      const result = captureTag.parse('capture', laxParser('my_var'), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.VariableLookup,
        name: 'my_var',
        lookups: [],
      });
    });
  });
});
