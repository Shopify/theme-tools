/*
 * Lone surrogates take the TS fallback, so their output is the TS output.
 *
 * A string that is not well-formed UTF-16 cannot become UTF-8 without a
 * replacement character, which would shift every later offset. `backend.ts`
 * checks `isWellFormed()` before it calls the backend and counts an
 * `illFormed` fallback instead. These inputs stay out of the parity corpus,
 * which must show 0 fallbacks.
 *
 * | Mode | Assertion per input and config                                      |
 * |------|---------------------------------------------------------------------|
 * | TS   | two parses give equal canonical outcomes                            |
 * | Rust | the outcome equals the TS outcome, `parses` is unchanged, and       |
 * |      | `fallbacks.illFormed` goes up by exactly 1                          |
 */
import { describe, expect, it } from 'vitest';
import {
  toLiquidAST,
  toLiquidHtmlAST,
  toTolerantLiquidAST,
  toTolerantLiquidHtmlAST,
} from '../index';
import type { ASTBuildOptions } from '../index';
import { BACKEND_KEY } from '../backend';
import type { ParserBackend } from '../backend';
import { canonicalOutcome, withoutBackend } from './outcome';
import type { Outcome } from './outcome';

type Parse = (source: string, options?: ASTBuildOptions) => unknown;

const ENTRIES: [string, Parse][] = [
  ['liquidHtml', toLiquidHtmlAST],
  ['liquid', toLiquidAST],
  ['tolerantLiquidHtml', toTolerantLiquidHtmlAST],
  ['tolerantLiquid', toTolerantLiquidAST],
];

const CONFIGS: [string, ASTBuildOptions | undefined][] = [
  ['default', undefined],
  ['closed', { allowUnclosedDocumentNode: false, mode: 'tolerant' }],
  ['unclosed', { allowUnclosedDocumentNode: true, mode: 'tolerant' }],
  ['strict', { allowUnclosedDocumentNode: false, mode: 'strict' }],
  ['completion', { allowUnclosedDocumentNode: true, mode: 'completion' }],
];

const INPUTS: [string, string][] = [
  ['lone-high', '\uD800'],
  ['lone-low', '\uDC00'],
  ['reversed-pair', 'a\uDC00\uD800b'],
  ['attr-lone-high', '<div title="x\uD83D">y</div>'],
  ['liquid-string-lone-low', "{{ 'a\uDFFF' }}"],
  ['unclosed-if-lone-high', '{% if a %}\uD800'],
];

describe('lone surrogates', () => {
  for (const [entry, parse] of ENTRIES) {
    it(`lone surrogates fall back to TS: ${entry}`, () => {
      for (const [config, options] of CONFIGS) {
        for (const [id, source] of INPUTS) {
          const label = `${id} ${entry} ${config}`;
          expect(isWellFormed(source), label).toBe(false);
          checkInput(parse, source, options, label);
        }
      }
    });
  }
});

function checkInput(
  parse: Parse,
  source: string,
  options: ASTBuildOptions | undefined,
  label: string,
) {
  const backend = registeredBackend();
  if (!backend) return checkTsStable(parse, source, options, label);
  checkRustFallback(backend, parse, source, options, label);
}

function checkTsStable(
  parse: Parse,
  source: string,
  options: ASTBuildOptions | undefined,
  label: string,
) {
  const first = canonicalOutcome(run(parse, source, options), source);
  const second = canonicalOutcome(run(parse, source, options), source);
  expect(first === second, label).toBe(true);
}

function checkRustFallback(
  backend: ParserBackend,
  parse: Parse,
  source: string,
  options: ASTBuildOptions | undefined,
  label: string,
) {
  const parsesBefore = backend.stats.parses;
  const illFormedBefore = backend.stats.fallbacks.illFormed;
  const rust = canonicalOutcome(run(parse, source, options), source);
  const parsesAfter = backend.stats.parses;
  const illFormedAfter = backend.stats.fallbacks.illFormed;
  const ts = canonicalOutcome(
    withoutBackend(() => run(parse, source, options)),
    source,
  );

  expect(rust === ts, label).toBe(true);
  expect(parsesAfter - parsesBefore, `${label} parses`).toBe(0);
  expect(illFormedAfter - illFormedBefore, `${label} illFormed`).toBe(1);
}

function run(parse: Parse, source: string, options: ASTBuildOptions | undefined): Outcome {
  try {
    const value = options === undefined ? parse(source) : parse(source, { ...options });
    return { threw: false, value };
  } catch (error) {
    return { threw: true, value: error };
  }
}

function registeredBackend(): ParserBackend | undefined {
  return (globalThis as Record<symbol, ParserBackend | undefined>)[BACKEND_KEY];
}

function isWellFormed(source: string): boolean {
  return (source as string & { isWellFormed(): boolean }).isWellFormed();
}
