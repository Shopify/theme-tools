import { describe, expect, it } from 'vitest';
import { cycleTag } from './cycle';
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
 *  cycle tag via `laxRecoverTagMarkup` (`enableLax()`). */
function laxParser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup).enableLax();
}

const stubParser = {} as Parser;

describe('cycleTag', () => {
  it('has standalone kind', () => {
    expect(cycleTag.kind).toBe(TagKind.Tag);
  });

  it('parses cycle without group name', () => {
    const result = cycleTag.parse('cycle', parser("'a', 'b', 'c'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.CycleMarkup,
      groupName: null,
      args: [
        { type: NodeTypes.String, value: 'a' },
        { type: NodeTypes.String, value: 'b' },
        { type: NodeTypes.String, value: 'c' },
      ],
    });
  });

  it('parses cycle with group name', () => {
    const result = cycleTag.parse('cycle', parser("'group': 'a', 'b', 'c'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.CycleMarkup,
      groupName: { type: NodeTypes.String, value: 'group' },
      args: [
        { type: NodeTypes.String, value: 'a' },
        { type: NodeTypes.String, value: 'b' },
        { type: NodeTypes.String, value: 'c' },
      ],
    });
  });

  it('parses single expression', () => {
    const result = cycleTag.parse('cycle', parser("'only'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.CycleMarkup,
      groupName: null,
      args: [{ type: NodeTypes.String, value: 'only' }],
    });
  });

  // ── Lax recovery: leading-dot numbers + trailing comma ────────────────────
  // These cases fail strict parse and arrive at the render-tree as base-case
  // nodes, where `laxRecoverTagMarkup` re-runs `cycleTag.parse` under
  // `enableLax()`. They mirror Ruby `cycle.rb` `lax_parse` / `variables_from_string`.

  describe('lax recovery', () => {
    it('strict parse throws on a leading-dot number (`.5`)', () => {
      // DD-7: strict `toLiquidHtmlAST` output is unchanged — `.5` is a syntax
      // error in strict mode.
      expect(() => cycleTag.parse('cycle', parser('.5, .4'), stubParser)).toThrow();
    });

    it('recovers leading-dot numbers as digit-named variable lookups (#2857)', () => {
      // `{% cycle .5, .4 %}` — Ruby `Expression.parse(".5")` fails parse_number
      // (first byte is `.`) and falls to `VariableLookup.parse(".5")`, whose
      // `VariableSegment = [\w\-]` scan skips the dot → lookup name `"5"`.
      const result = cycleTag.parse('cycle', laxParser('.5, .4'), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.CycleMarkup,
        groupName: null,
        args: [
          { type: NodeTypes.VariableLookup, name: '5', lookups: [] },
          { type: NodeTypes.VariableLookup, name: '4', lookups: [] },
        ],
      });
    });

    it('recovers a leading-dot name whose digit segment continues into letters', () => {
      // `{% cycle .5foo, 'x' %}` — the tokenizer splits `.5foo` into
      // Dot, Number("5"), Id("foo"). Ruby's `VariableSegment = [\w\-]` scan
      // takes the whole run after the dot, so the lookup name is `"5foo"`, not
      // the truncated `"5"`.
      const result = cycleTag.parse('cycle', laxParser(".5foo, 'x'"), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.CycleMarkup,
        groupName: null,
        args: [
          { type: NodeTypes.VariableLookup, name: '5foo', lookups: [] },
          { type: NodeTypes.String, value: 'x' },
        ],
      });
    });

    it('recovers a leading-dot number in the named (group) form (#2858)', () => {
      // `{% cycle .5: 'a', 'b' %}` — group name is VariableLookup `"5"`.
      const result = cycleTag.parse('cycle', laxParser(".5: 'a', 'b'"), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.CycleMarkup,
        groupName: { type: NodeTypes.VariableLookup, name: '5', lookups: [] },
        args: [
          { type: NodeTypes.String, value: 'a' },
          { type: NodeTypes.String, value: 'b' },
        ],
      });
    });

    it('strict parse throws on a trailing comma', () => {
      // DD-7: a trailing comma stays a strict syntax error (theme-check relies
      // on this), so the tolerance is lax-only.
      expect(() => cycleTag.parse('cycle', parser('"1", "2",'), stubParser)).toThrow();
    });

    it('tolerates a trailing comma under lax recovery (#2865)', () => {
      // `{% cycle "1", "2", %}` — Ruby drops the empty trailing comma segment
      // (`.compact`) → args `["1","2"]`.
      const result = cycleTag.parse('cycle', laxParser('"1", "2",'), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.CycleMarkup,
        groupName: null,
        args: [
          { type: NodeTypes.String, value: '1' },
          { type: NodeTypes.String, value: '2' },
        ],
      });
    });

    it('tolerates a trailing comma after a single value (#2865, last cycle)', () => {
      const result = cycleTag.parse('cycle', laxParser('"1",'), stubParser);
      expect(result).toMatchObject({
        type: NodeTypes.CycleMarkup,
        groupName: null,
        args: [{ type: NodeTypes.String, value: '1' }],
      });
    });

    // Regression: the 5 already-passing whitespace-separated trailing-element
    // specs (#2859–#2863) recover the FIRST fragment of each comma segment and
    // discard the rest, matching Ruby `variables_from_string`.

    it('recovers first fragment, discarding whitespace-separated trailing tokens (#2861)', () => {
      // `{% cycle 'a'  'b', 'c' %}` → first segment first fragment `'a'`.
      const result = cycleTag.parse('cycle', laxParser("'a'  'b', 'c'"), stubParser);
      expect(result.args[0]).toMatchObject({ type: NodeTypes.String, value: 'a' });
    });

    it('recovers the named-form first fragment with trailing tokens (#2862)', () => {
      // `{% cycle name: 'a'  'b', 'c' %}` → group `name`, first arg `'a'`.
      const result = cycleTag.parse('cycle', laxParser("name: 'a'  'b', 'c'"), stubParser);
      expect(result.groupName).toMatchObject({ type: NodeTypes.VariableLookup, name: 'name' });
      expect(result.args[0]).toMatchObject({ type: NodeTypes.String, value: 'a' });
    });
  });
});
