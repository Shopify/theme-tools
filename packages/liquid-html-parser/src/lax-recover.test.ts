import { describe, expect, it } from 'vitest';
import { laxRecoverVariable, laxRecoverTagMarkup, LaxTagRecoveryError } from './lax-recover';
import { MarkupParser } from './markup/parser';
import { tokenizeMarkup } from './markup/tokenizer';
import { NodeTypes } from './types';
import type {
  AssignMarkup,
  LiquidComparison,
  LiquidLogicalExpression,
  LiquidVariable,
  LiquidVariableLookup,
} from './ast';

describe('laxRecoverVariable', () => {
  it('recovers an incomplete expression to its leading literal', () => {
    const v = laxRecoverVariable('false a', 'false a', 0)!;
    expect(v.expression.type).toBe(NodeTypes.LiquidLiteral);
    expect(v.filters).toHaveLength(0);
  });

  it('recovers an invalid numeric-prefixed name as a VariableLookup', () => {
    const v = laxRecoverVariable('123foo', '123foo', 0)!;
    const lookup = v.expression as LiquidVariableLookup;
    expect(lookup.type).toBe(NodeTypes.VariableLookup);
    expect(lookup.name).toBe('123foo');
  });

  it('flattens a doubly-bracketed lookup to the inner name', () => {
    const v = laxRecoverVariable("[['BIG']]", "[['BIG']]", 0)!;
    const lookup = v.expression as LiquidVariableLookup;
    expect(lookup.type).toBe(NodeTypes.VariableLookup);
    expect(lookup.name).toBeNull();
    expect(lookup.lookups).toHaveLength(1);
    expect(lookup.lookups[0]).toMatchObject({ type: NodeTypes.String, value: 'BIG' });
  });

  it('keeps a well-formed filter while dropping a malformed one (resync on |)', () => {
    const src = `'hi there' | split:"t"" | remove:"i" | first`;
    const v = laxRecoverVariable(src, src, 0)!;
    const names = v.filters.map((f) => f.name);
    expect(names).toContain('split');
    expect(names).toContain('first');
    expect(names).not.toContain('remove');
  });

  it('tolerates a trailing filter colon with no arguments', () => {
    const v = laxRecoverVariable(`"test" | upcase:`, `"test" | upcase:`, 0)!;
    expect(v.filters).toHaveLength(1);
    expect(v.filters[0].name).toBe('upcase');
    expect(v.filters[0].args).toHaveLength(0);
  });

  it("returns a VariableLookup named '-' for a bare dash", () => {
    const v = laxRecoverVariable('-', '-', 0)!;
    expect((v.expression as LiquidVariableLookup).name).toBe('-');
  });

  it('recovers an unknown comparator in a value context to its leading literal', () => {
    // `{{ false = }}` → Ruby renders the bare left operand ("false"). The
    // unknown-comparator lax recovery applies in value contexts only.
    const v = laxRecoverVariable('false =', 'false =', 0)!;
    expect(v.expression.type).toBe(NodeTypes.LiquidLiteral);
    expect(v.filters).toHaveLength(0);
  });
});

describe('laxRecoverTagMarkup', () => {
  it('recovers an assign with an invalid numeric-prefixed name', () => {
    const markup = laxRecoverTagMarkup('assign', "123foo = 'bar'", "123foo = 'bar'", 0, 14) as
      | AssignMarkup
      | undefined;
    expect(markup).toBeDefined();
    expect(markup!.name).toBe('123foo');
    expect((markup!.value as LiquidVariable).expression).toMatchObject({
      type: NodeTypes.String,
      value: 'bar',
    });
  });

  it('recovers an assign with a meaningless-parens value (resolves to a lookup)', () => {
    const src = "foo = ('X' | downcase)";
    const markup = laxRecoverTagMarkup('assign', src, src, 0, src.length) as
      | AssignMarkup
      | undefined;
    expect(markup?.name).toBe('foo');
  });

  it('captures an Id-prefixed invalid assign name as a literal key (`a.b`)', () => {
    const src = "a.b = 'bar'";
    const markup = laxRecoverTagMarkup('assign', src, src, 0, src.length) as AssignMarkup;
    expect(markup.name).toBe('a.b');
    expect((markup.value as LiquidVariable).expression).toMatchObject({
      type: NodeTypes.String,
      value: 'bar',
    });
  });

  it('captures a bracketed invalid assign name as a literal key (`foo[bar]`)', () => {
    const src = "foo[bar] = 'baz'";
    const markup = laxRecoverTagMarkup('assign', src, src, 0, src.length) as AssignMarkup;
    expect(markup.name).toBe('foo[bar]');
  });

  it('binds the last whitespace-separated run when multiple tokens precede `=`', () => {
    // Ruby's lax assign `Syntax` is unanchored, so `VariableSignature+` matches
    // only the final contiguous run before `=`; the leading tokens are dropped.
    // `{% assign foo bar = 'x' %}` therefore assigns to `bar`, not `foo bar`
    // (verified against Ruby 5.11.0: `[{{foo}}][{{bar}}]` renders `[][x]`).
    const cases: Array<[string, string]> = [
      ["foo bar = 'x'", 'bar'],
      ["a b c = 'x'", 'c'],
      ["foo.bar baz = 'x'", 'baz'],
      ["123 foo = 'x'", 'foo'],
    ];
    for (const [src, expected] of cases) {
      const markup = laxRecoverTagMarkup('assign', src, src, 0, src.length) as AssignMarkup;
      expect(markup.name).toBe(expected);
      expect((markup.value as LiquidVariable).expression).toMatchObject({
        type: NodeTypes.String,
        value: 'x',
      });
    }
  });

  it('throws for invalid assign syntax with no `=` (`foo not values`)', () => {
    // Core Liquid raises a syntax error via assign.rb when the markup does not
    // match `(VariableSignature+)\s*=\s*(.*)`. Recovery must propagate, not
    // reduce to empty output.
    const src = 'foo not values';
    expect(() => laxRecoverTagMarkup('assign', src, src, 0, src.length)).toThrow();
  });

  it('throws a LaxTagRecoveryError for an unknown tag', () => {
    // Core Liquid raises "Unknown tag" via block.rb; recovery surfaces it
    // instead of swallowing to empty output.
    expect(() => laxRecoverTagMarkup('nope', 'x', 'x', 0, 1)).toThrow(LaxTagRecoveryError);
  });

  it('recovers an unknown comparator in a condition by preserving the operator (`{% if 0 = 0 %}`)', () => {
    // `=` is not a valid conditional operator. Lax recovery preserves it
    // verbatim as a Comparison so the engine raises "Unknown operator =" at
    // evaluate time (matching Ruby), rather than silently rendering a branch
    // from a truncated left operand. (The matching value-context case,
    // `{{ false = }}` → "false", recovers to the bare left literal instead —
    // see laxRecoverVariable.)
    const src = '0 = 0';
    const markup = laxRecoverTagMarkup('if', src, src, 0, src.length) as
      | LiquidComparison
      | undefined;
    expect(markup).toBeDefined();
    expect(markup!.type).toBe(NodeTypes.Comparison);
    expect(markup!.comparator).toBe('=');
  });

  it('recovers a bare-word unknown operator in a condition by preserving it (`{% if true true %}`)', () => {
    // A bare word in the comparator slot follows the left operand with only
    // whitespace between them (not the punctuation garbage `&&`/`||` core Liquid
    // drops), so lax recovery captures it verbatim as the comparator. The engine
    // raises "Unknown operator true" at evaluate time — it does NOT reduce to the
    // (truthy) left operand. The render-tree tests assert the surfaced error.
    const markup = laxRecoverTagMarkup('if', 'true true', 'true true', 0, 9) as
      | LiquidComparison
      | undefined;
    expect(markup).toBeDefined();
    expect(markup!.type).toBe(NodeTypes.Comparison);
    expect(markup!.comparator).toBe('true');
  });

  it('stops the unknown-operator run at markupEnd in `{% liquid %}` line-mode', () => {
    // In a `{% liquid %}` block, `source` is the whole template but `markupEnd`
    // is the current line's markup boundary. The operator run must not skip the
    // newline and capture the next statement's tag word (`echo`, `assign`, …) as
    // a bogus operator. Here the malformed `(true` line reduces to the bare
    // `true` literal; the `echo` on the next line stays out of the run.
    const markupString = '(true';
    const source = "(true\n  echo 'x'\n";
    const markupEnd = markupString.length;
    const markup = laxRecoverTagMarkup('if', markupString, source, 0, markupEnd) as
      | LiquidComparison
      | { type: NodeTypes };
    // Bare literal, not a Comparison that captured `echo`.
    expect((markup as LiquidComparison).comparator).toBeUndefined();
    expect(markup.type).toBe(NodeTypes.LiquidLiteral);
  });

  it('still recovers the punctuation quirks core Liquid ignores (`||`, `&&`)', () => {
    // `||` tokenizes as pipes and `&&` is dropped by the tokenizer; both leave a
    // non-whitespace source gap, so they are discarded and the condition reduces
    // to its left operand rather than raising.
    expect(laxRecoverTagMarkup('if', 'false || true', 'false || true', 0, 13)).toBeDefined();
    expect(laxRecoverTagMarkup('if', 'true && false', 'true && false', 0, 13)).toBeDefined();
  });

  it('recovers a known word operator fused with its right operand (`arr contains0`)', () => {
    // The tokenizer matches `contains0` as one Id token, so `contains` never
    // surfaces as its own Comparison token. Ruby's lax `if.rb` Syntax still
    // captures `(arr)(contains)(0)`, so recovery must build a `contains`
    // comparison with `0` as the right operand — NOT reduce to the bare left
    // operand (which would silently make the condition `arr` truthiness).
    const src = 'arr contains0';
    const markup = laxRecoverTagMarkup('if', src, src, 0, src.length) as
      | LiquidComparison
      | undefined;
    expect(markup).toBeDefined();
    expect(markup!.type).toBe(NodeTypes.Comparison);
    expect(markup!.comparator).toBe('contains');
    expect(markup!.right).toMatchObject({ type: NodeTypes.Number, value: '0' });
  });

  it('retains a trailing logical clause after a merged multi-token right operand (`str contains0.0 and false`)', () => {
    // The fused token `contains0` ends before the recovered right operand `0.0`
    // (`contains` is the operator, `0.0` the operand), so the leftover Dot/Number
    // tokens sit on the main stream after the sub-parser consumes the operand. The
    // main cursor must advance past them or `and false` is dropped, leaving a bare
    // `str contains 0.0`. Ruby's `if.rb` lax parse treats the fused form
    // identically to the spaced `str contains 0.0 and false` — `(str contains 0.0)
    // and (false)` — so recovery must keep the trailing clause to match.
    const src = 'str contains0.0 and false';
    const markup = laxRecoverTagMarkup('if', src, src, 0, src.length) as
      | LiquidLogicalExpression
      | undefined;
    expect(markup).toBeDefined();
    expect(markup!.type).toBe(NodeTypes.LogicalExpression);
    expect(markup!.relation).toBe('and');
    const left = markup!.left as LiquidComparison;
    expect(left.type).toBe(NodeTypes.Comparison);
    expect(left.comparator).toBe('contains');
    expect(left.right).toMatchObject({ type: NodeTypes.Number, value: '0.0' });
    expect(markup!.right).toMatchObject({ type: NodeTypes.LiquidLiteral, value: false });
  });
});

describe('lax mode is inert in strict parsing', () => {
  // Guard: the lax branches must never affect a parser that has not had
  // enableLax() called. This is what keeps `toLiquidHtmlAST` / theme-check
  // strict. Malformed markup must still throw or leave residual tokens.
  it('throws on meaningless parens in strict mode', () => {
    const src = "('X' | downcase)";
    const p = new MarkupParser(tokenizeMarkup(src), src);
    expect(() => p.liquidVariable()).toThrow();
  });

  it('does not consume a trailing identifier in strict mode (leaves residual)', () => {
    const src = 'false a';
    const p = new MarkupParser(tokenizeMarkup(src), src);
    p.liquidVariable();
    // The trailing `a` is left unconsumed — strict callers treat this as a
    // base-case (parse failure), not a recovered value.
    expect(p.isAtEnd()).toBe(false);
  });

  it('treats a numeric-prefixed name as a bare Number in strict mode', () => {
    const src = '123foo';
    const p = new MarkupParser(tokenizeMarkup(src), src);
    const v = p.liquidVariable();
    expect(v.expression.type).toBe(NodeTypes.Number);
    expect(p.isAtEnd()).toBe(false); // trailing `foo` residual
  });

  it('enableLax() returns the parser for chaining', () => {
    const p = new MarkupParser(tokenizeMarkup('x'), 'x');
    expect(p.enableLax()).toBe(p);
    expect(p.isLax()).toBe(true);
  });
});
