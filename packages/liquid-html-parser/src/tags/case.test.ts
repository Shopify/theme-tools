import { describe, expect, it } from 'vitest';
import { caseTag, whenBranchParse } from './case';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

function laxParser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup).enableLax();
}

const stubParser = {} as Parser;

describe('caseTag', () => {
  it('has block kind', () => {
    expect(caseTag.kind).toBe(TagKind.Block);
  });

  it('has when and else branches', () => {
    expect(caseTag.branches).toEqual(['when', 'else']);
  });

  it('parses a variable lookup', () => {
    const result = caseTag.parse('case', parser('product.type'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'product',
      lookups: [{ type: NodeTypes.String, value: 'type' }],
    });
  });
});

describe('whenBranchParse', () => {
  it('parses comma-separated values as LiquidExpression array', () => {
    const result = whenBranchParse('when', parser('1, 2, 3'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ type: NodeTypes.Number, value: '1' });
    expect(result[1]).toMatchObject({ type: NodeTypes.Number, value: '2' });
    expect(result[2]).toMatchObject({ type: NodeTypes.Number, value: '3' });
  });

  it('parses or-separated values as LiquidExpression array (NOT logical)', () => {
    const result = whenBranchParse('when', parser('a or b or c'));
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ type: NodeTypes.VariableLookup, name: 'a' });
    expect(result[1]).toMatchObject({ type: NodeTypes.VariableLookup, name: 'b' });
    expect(result[2]).toMatchObject({ type: NodeTypes.VariableLookup, name: 'c' });
  });

  it('parses string values', () => {
    const result = whenBranchParse('when', parser('"hello", "world"'));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: NodeTypes.String, value: 'hello' });
    expect(result[1]).toMatchObject({ type: NodeTypes.String, value: 'world' });
  });

  it('parses an optional trailing colon after a when value', () => {
    const p = parser("'actions':");
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.String, value: 'actions' });
    expect(p.isAtEnd()).toBe(true);
  });

  it('parses an optional trailing colon after comma-separated when values', () => {
    const p = parser("'logo', 'actions':");
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: NodeTypes.String, value: 'logo' });
    expect(result[1]).toMatchObject({ type: NodeTypes.String, value: 'actions' });
    expect(p.isAtEnd()).toBe(true);
  });

  it('does not consume post-colon tokens', () => {
    const p = parser("'logo': 'actions'");
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.String, value: 'logo' });
    expect(p.isAtEnd()).toBe(false);
  });

  it('does not consume a whitespace-separated colon', () => {
    const p = parser('item :');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.VariableLookup, name: 'item' });
    expect(p.isAtEnd()).toBe(false);
  });

  // --- lax recovery (Ruby `parse_lax_when`, `case.rb:132-143`) ----------------
  // These exercise the render-tree lax path ONLY (parser created with
  // enableLax()). Strict parsing never reaches them — DD-7 keeps the strict AST
  // (theme-check) output unchanged; see the strict assertions at the bottom.

  it('strict: clean comma list leaves nothing unconsumed (AST unchanged)', () => {
    const p = parser('1, 2');
    const result = whenBranchParse('when', p);
    expect(result.map((e) => (e as { value: string }).value)).toEqual(['1', '2']);
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: a trailing element after a when-value is dropped (`when 1 bar` -> [1])', () => {
    const p = laxParser('1 bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.Number, value: '1' });
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: contiguous `=>` folds into the lookup (`when foo=>bar` -> foo.bar)', () => {
    const p = laxParser('foo=>bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'foo',
      lookups: [{ type: NodeTypes.String, value: 'bar' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it("lax: a digit-only glued segment is recovered (`when foo=>123` -> foo['123'])", () => {
    // Ruby's `VariableSegment = [\w\-]` includes digits, so `foo=>123` scans as
    // name `foo` + segment `123` → `foo["123"]`. The JS tokenizer emits a
    // Number for `123`, so token-type matching alone would drop it.
    const p = laxParser('foo=>123');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'foo',
      lookups: [{ type: NodeTypes.String, value: '123' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it("lax: a leading-dash glued segment keeps the dash (`when foo=>-bar` -> foo['-bar'])", () => {
    // `-` is a word character in Ruby's `[\w\-]`, so `foo=>-bar` scans the
    // single run `-bar` as the segment → `foo["-bar"]` (NOT `foo["bar"]`). The
    // JS tokenizer splits the leading `-` into a Dash token; the recovery must
    // include it in the segment value.
    const p = laxParser('foo=>-bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'foo',
      lookups: [{ type: NodeTypes.String, value: '-bar' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it("lax: a leading-dash numeric glued segment keeps the dash (`when foo=>-12` -> foo['-12'])", () => {
    const p = laxParser('foo=>-12');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'foo',
      lookups: [{ type: NodeTypes.String, value: '-12' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it("lax: a word-valued `contains` glued segment is recovered (`when foo=>contains` -> foo['contains'])", () => {
    // Regression: the tokenizer classifies the bare word `contains` as
    // `Comparison` (tokenizer.ts), the same type as the symbolic `>`/`<`
    // operators the skip loop crosses. A type-only check skipped `contains`
    // too, so `expectedStart` landed past it and the segment scan found
    // nothing — the recovered lookup was just `foo`. The skip now crosses only
    // tokens whose source text is pure symbolic punctuation, so `contains`
    // ends the skip and is scanned as the `[\w-]+` segment, matching Ruby's
    // `foo=>contains` → `foo["contains"]`.
    const p = laxParser('foo=>contains');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'foo',
      lookups: [{ type: NodeTypes.String, value: 'contains' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: a trailing comma with no following value keeps the values so far (`when 1,` -> [1])', () => {
    // Ruby `WhenSyntax` (`case.rb:27`) only continues when a separator is
    // followed by another QuotedFragment; a trailing `,` leaves group 2 nil so
    // `parse_lax_when` keeps `[1]`. The separator is consumed, then the missing
    // value breaks the loop and `discardTrailing()` swallows nothing left.
    const p = laxParser('1,');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.Number, value: '1' });
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: a trailing `or` with no following value keeps the values so far (`when 1 or` -> [1])', () => {
    const p = laxParser('1 or');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.Number, value: '1' });
    expect(p.isAtEnd()).toBe(true);
  });

  it("lax: a literal keyword folds a contiguous `=>` into a lookup (`when true=>bar` -> true['bar'])", () => {
    // Ruby `LITERALS` keys are exact, so `Expression.parse("true=>bar")` misses
    // the `true` key and falls to `VariableLookup.parse` → `true["bar"]`
    // (`expression.rb:40-46`). The literal fast-path must defer to the lookup
    // fold when a contiguous separator follows.
    const p = laxParser('true=>bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'true',
      lookups: [{ type: NodeTypes.String, value: 'bar' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it("lax: a bare number folds a contiguous `=>` into a lookup (`when 1=>bar` -> 1['bar'])", () => {
    // `Expression.parse("1=>bar")` fails INTEGER_REGEX and falls to
    // `VariableLookup.parse` → `1["bar"]` (`expression.rb:40-46`). The number's
    // source text is the lookup base name.
    const p = laxParser('1=>bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: '1',
      lookups: [{ type: NodeTypes.String, value: 'bar' }],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: a dangling literal-keyword operator folds to an empty lookup (`when true=>` -> true[])', () => {
    // A glued operator run with NO trailing word is still not a literal in Ruby:
    // `Expression.parse("true=>")` misses the `LITERALS` key and falls to
    // `VariableLookup.parse` → `VariableLookup("true")` with EMPTY lookups (→ nil).
    const p = laxParser('true=>');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'true',
      lookups: [],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: a dangling number operator folds to an empty lookup (`when 1<` -> 1[])', () => {
    // `Expression.parse("1<")` fails INTEGER_REGEX and falls to
    // `VariableLookup.parse` → `VariableLookup("1")` with EMPTY lookups (→ nil).
    const p = laxParser('1<');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: '1',
      lookups: [],
    });
    expect(p.isAtEnd()).toBe(true);
  });

  it('lax: a bare literal with no contiguous separator stays a literal (`when true` -> literal)', () => {
    // The fast-path is preserved: only a contiguous `=>word` run defers to the
    // lookup fold; a plain literal keyword is unchanged.
    const p = laxParser('true');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.LiquidLiteral, keyword: 'true' });
    expect(p.isAtEnd()).toBe(true);
  });

  it('strict: a trailing comma is NOT recovered (leaves residual for raw-string fallback)', () => {
    // DD-7: strict parsing keeps the separator-then-empty-value throw so the
    // document layer's raw-string fallback fires; the lax break never runs.
    const p = parser('1,');
    expect(() => whenBranchParse('when', p)).toThrow();
  });

  it('strict: `true=>bar` is NOT folded into a lookup (returns the literal, leaves residual)', () => {
    const p = parser('true=>bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.LiquidLiteral, keyword: 'true' });
    expect(p.isAtEnd()).toBe(false);
  });

  it('strict: a trailing element is NOT recovered (leaves residual for raw-string fallback)', () => {
    // DD-7: strict parsing must keep its raw-string fallback so the document
    // layer (`parseBranchMarkup`) reports the malformed `when` unchanged. The
    // value parses, but the residual `bar` keeps `isAtEnd()` false.
    const p = parser('1 bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(p.isAtEnd()).toBe(false);
  });

  it('strict: `foo=>bar` is NOT folded into a lookup (leaves residual)', () => {
    const p = parser('foo=>bar');
    const result = whenBranchParse('when', p);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: NodeTypes.VariableLookup, name: 'foo', lookups: [] });
    expect(p.isAtEnd()).toBe(false);
  });
});

describe('caseTag lax recovery', () => {
  it('lax: trailing element on the case-left is dropped (`case 1 bar` left = 1)', () => {
    const p = laxParser('1 bar');
    const result = caseTag.parse('case', p, stubParser);
    expect(result).toMatchObject({ type: NodeTypes.Number, value: '1' });
  });

  it('lax: contiguous `=>` on the case-left folds into the lookup (`foo=>bar` -> foo.bar)', () => {
    const p = laxParser('foo=>bar');
    const result = caseTag.parse('case', p, stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.VariableLookup,
      name: 'foo',
      lookups: [{ type: NodeTypes.String, value: 'bar' }],
    });
  });
});
