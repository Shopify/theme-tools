import type { LiquidVariableLookup } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';

/**
 * Mirrors core Liquid's lax capture name parsing
 * (`lib/liquid/tags/capture.rb`):
 *
 *   Syntax = /(#{VariableSignature}+)/o
 *   VariableSignature = /\(?[\w\-\.\[\]]\)?/   (lib/liquid.rb)
 *
 * `lax_parse` runs `markup =~ Syntax` against the WHOLE markup string and takes
 * the first contiguous `VariableSignature+` run as the target name. The regex is
 * unanchored, so it skips a leading quote (or any other non-signature byte) and
 * stops at the first space/punctuation:
 *
 *   `'var'`     → `var`
 *   `"thing"`   → `thing`
 *   `'foo bar'` → `foo`     (stops at the space)
 *   `'foo!bar'` → `foo`     (stops at `!`)
 *   `(x[y`      → `(x[y`    (parens/brackets are signature chars)
 *
 * Markup with no signature byte at all (`''`, empty, only spaces) does NOT match
 * and Ruby raises `SyntaxError` — i.e. it is unrecoverable.
 */
const CAPTURE_NAME = /((?:\(?[\w\-.[\]]\)?)+)/;

export const captureTag: TagDefinitionBlock<LiquidVariableLookup> = {
  kind: TagKind.Block,
  branches: [],
  parse(_name: string, markup: MarkupParser, _parser: Parser): LiquidVariableLookup {
    // Lax recovery only (markup.isLax()): reproduce Ruby's whole-markup
    // `VariableSignature+` scan so quoted targets (`'var'`) AND core-tested
    // invalid names (`(x[y`, see capture_test.rb#test_capture_allows_invalid_names_in_lax)
    // recover identically. Strict `toLiquidHtmlAST` still rejects these (the
    // strict path below throws via `variableLookup()`), so strict output and
    // theme-check are unchanged (DD-7). Mirrors `assignTag`'s lax-name handling.
    if (markup.isLax()) {
      // `bodyContext()` returns the raw markup range (and advances the cursor to
      // end, mirroring `liquid.ts`); `CAPTURE_NAME` is unanchored so it skips a
      // leading quote/space exactly like Ruby's `markup =~ Syntax`.
      const { source, bodyStart, bodyEnd } = markup.bodyContext();
      const match = CAPTURE_NAME.exec(source.slice(bodyStart, bodyEnd));
      if (match) {
        return {
          type: NodeTypes.VariableLookup,
          name: match[1],
          lookups: [],
          position: { start: bodyStart, end: bodyEnd },
          source: '',
        };
      }
      // No VariableSignature run (`''`, empty, spaces only) → unrecoverable in
      // Ruby (raises SyntaxError). `variableLookup()` likewise throws here.
    }
    return markup.variableLookup();
  },
};
