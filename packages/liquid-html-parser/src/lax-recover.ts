/**
 * Lax recovery of malformed Liquid markup, mirroring Ruby liquid's lax parse
 * mode (`Liquid::ParserSwitching` strict-then-lax fallback).
 *
 * IMPORTANT: nothing in this module is reachable from `toLiquidHtmlAST` or the
 * document-layer parsers. Strict parsing (the AST that `theme-check` consumes)
 * is completely unaffected. These helpers exist solely so the render-tree
 * (`@editor/liquid-render-tree`) can reproduce Ruby's *rendered output* for a
 * `{{ }}` / `{% %}` that already failed strict parsing and arrived as a
 * base-case (string-markup) node. The render-tree is not consumed by the
 * linter, so the linter still reports these as syntax errors.
 *
 * The recovery re-tokenizes the raw markup and re-parses it with the existing
 * `MarkupParser` lax mode (`enableLax()`), and — for tags — re-runs the tag's
 * own `parse` callback, keeping the lax grammar in one place.
 */
import type { LiquidExpression, LiquidVariable } from './ast';
import { MarkupParser } from './markup/parser';
import { tokenizeMarkup } from './markup/tokenizer';
import { builtinTags } from './tags/index';
import { whenBranchParse } from './tags/case';
import {
  TagKind,
  type Parser,
  type TagDefinition,
  type LiquidLineContext,
} from './tag-definitions';
import type { LiquidStatement } from './ast';

/**
 * Minimal stand-in for the `Parser` delegate. The lax-recovered tags
 * (`assign`, `echo`, `if`, `unless`, `for`) only use the `MarkupParser`
 * argument and never call back into `parseLiquidStatement`. If a future tag
 * recovery needs it, this throws loudly rather than silently mis-parsing.
 */
const noopParser: Parser = {
  parseLiquidStatement(
    _tagName: string,
    _markupString: string,
    _startOffset: number,
    _ctx: LiquidLineContext,
  ): LiquidStatement {
    throw new Error('lax-recover: nested statement parsing is not supported during recovery');
  },
};

/**
 * Lax-recover the `LiquidVariable` for a string-markup `{{ ... }}`.
 * Returns `undefined` when even lax parsing cannot produce a value (the caller
 * then falls back to rendering nothing / the raw string).
 */
export function laxRecoverVariable(
  rawMarkup: string,
  source: string,
  offset: number,
): LiquidVariable | undefined {
  try {
    const tokens = tokenizeMarkup(rawMarkup, offset);
    const parser = new MarkupParser(tokens, source, offset, offset + rawMarkup.length).enableLax();
    const variable = parser.liquidVariable();
    return variable;
  } catch {
    return undefined;
  }
}

/**
 * Lax-recover the structured markup for a base-case tag (`{% name markup %}`).
 * Looks up the tag definition and re-runs its `parse` callback under lax mode.
 * The returned value is the tag-specific markup node (`AssignMarkup`,
 * `LiquidVariable`, `LiquidConditionalExpression`, `ForMarkup`, …) that the
 * strict path would have produced.
 *
 * Unlike the variable recovery, this does NOT swallow failures into an
 * empty-output sentinel. Core Liquid still surfaces errors for unrecoverable or
 * semantically-invalid tag markup even in lax mode: an unknown tag raises via
 * `block.rb`, invalid assign syntax raises via `assign.rb`, and an unsupported
 * condition operator raises `Unknown operator …` via `condition.rb`. So this
 * throws a `LaxTagRecoveryError` (for an unknown tag) or propagates the parse
 * error (for malformed markup) instead of reducing to empty output. The
 * render-tree caller translates the thrown error into the rendered error
 * surface; only genuinely-empty lax renders return normally (the tag's own
 * `parse` succeeds and produces markup).
 */
export function laxRecoverTagMarkup(
  tagName: string,
  markupString: string,
  source: string,
  offset: number,
  markupEnd: number,
): unknown {
  const def: TagDefinition | undefined = (builtinTags as Record<string, TagDefinition>)[tagName];
  if (!def || (def.kind !== TagKind.Tag && def.kind !== TagKind.Block)) {
    throw new LaxTagRecoveryError(`Unknown tag '${tagName}'`);
  }
  // increment/decrement lax_parse is `@variable_name = markup.strip`, which
  // accepts empty markup as the shared "" counter slot. variableLookup() throws
  // on empty input rather than producing that slot, so signal "empty markup,
  // recoverable" to the render-tree caller (which synthesizes the empty-name
  // lookup) by returning undefined here instead of letting the parse throw.
  if ((tagName === 'increment' || tagName === 'decrement') && markupString.trim() === '') {
    return undefined;
  }
  const tokens = tokenizeMarkup(markupString, offset);
  const parser = new MarkupParser(tokens, source, offset, markupEnd).enableLax();
  return def.parse(tagName, parser, noopParser);
}

/**
 * Raised by `laxRecoverTagMarkup` when a base-case tag cannot be recovered
 * because it is not a real tag. Distinct from the parser's own
 * `LiquidHTMLASTParsingError` (thrown for malformed markup) so the render-tree
 * can recognize an unknown-tag failure specifically.
 */
export class LaxTagRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaxTagRecoveryError';
  }
}

/**
 * Lax-recover the value list for a `{% when ... %}` branch whose strict parse
 * failed (e.g. a trailing element `when 1 bar` or an invalid expression
 * `when foo=>bar`) and arrived as a raw string. `when` is a branch, not a
 * top-level tag in `builtinTags`, so it has no `TagDefinition`; its parse is
 * the standalone `whenBranchParse`, which consults lax mode to drop a trailing
 * fragment and (via the lax `variableLookup`) fold a contiguous `=>bar` into
 * the preceding lookup. Mirrors Ruby `parse_lax_when` (`case.rb:132-143`).
 * Returns `undefined` when even lax parsing fails (caller then yields no match).
 */
export function laxRecoverWhenValues(
  markupString: string,
  source: string,
  offset: number,
  markupEnd: number,
): LiquidExpression[] | undefined {
  try {
    const tokens = tokenizeMarkup(markupString, offset);
    const parser = new MarkupParser(tokens, source, offset, markupEnd).enableLax();
    return whenBranchParse('when', parser);
  } catch {
    return undefined;
  }
}
