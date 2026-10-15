/*
 * TS-vs-Rust differential parity test.
 *
 * One test per entry point and option config, 4 x 5 = 20, with the same
 * names in both `LIQUID_PARSER` modes. Each test parses every corpus input
 * through the public entry point, so in Rust mode every parse goes through the
 * backend hook, `JSON.parse`, and `backend.ts` hydration.
 *
 * What each input must satisfy depends on the mode and on whether the frozen
 * baseline `fixtures/golden-canonical/hashes.tsv` exists:
 *
 * | Mode | Goldens | Assertion                                                  |
 * |------|---------|------------------------------------------------------------|
 * | TS   | yes     | sha256 of the canonical outcome equals the frozen hash     |
 * | TS   | no      | two parses agree, and any throw is a parsing error         |
 * | Rust | yes     | the Rust hash equals the frozen hash                       |
 * | Rust | no      | canonical(rust) === canonical(ts)                          |
 *
 * In Rust mode the TS output comes from the same entry point with the backend
 * removed from `globalThis` for the duration of the call.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  LiquidHTMLASTParsingError,
  toLiquidAST,
  toLiquidHtmlAST,
  toTolerantLiquidAST,
  toTolerantLiquidHtmlAST,
} from '../index';
import type { ASTBuildOptions } from '../index';
import { BACKEND_KEY } from '../backend';
import { loadNodeCorpus } from './corpus';
import type { CorpusInput } from './corpus';
import { canonicalOutcome, describeThrow, firstDivergentPath, withoutBackend } from './outcome';
import type { Outcome } from './outcome';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const HASHES_FILE = path.join(PACKAGE_ROOT, 'fixtures', 'golden-canonical', 'hashes.tsv');

/* One test parses every corpus input, so the 5 s vitest default cannot hold. */
const TEST_TIMEOUT_MS = 600_000;

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

interface Case {
  input: CorpusInput;
  entry: string;
  config: string;
  parse: Parse;
  options: ASTBuildOptions | undefined;
}

let corpus: CorpusInput[] = [];
let frozen: Map<string, string> | undefined;

const rustMode = () => (globalThis as Record<symbol, unknown>)[BACKEND_KEY] !== undefined;

beforeAll(async () => {
  corpus = await loadNodeCorpus(PACKAGE_ROOT);
  frozen = fs.existsSync(HASHES_FILE) ? loadHashes(HASHES_FILE) : undefined;
  console.log(
    `Differential corpus: ${corpus.length} inputs, mode ${rustMode() ? 'rust' : 'ts'}, goldens ${
      frozen ? 'yes' : 'no'
    }`,
  );
});

describe('TS vs Rust differential', () => {
  for (const [entry, parse] of ENTRIES) {
    for (const [config, options] of CONFIGS) {
      it(
        `${entry} ${config}`,
        () => {
          const mismatches = corpus
            .map((input) => checkCase({ input, entry, config, parse, options }))
            .filter((line): line is string => line !== undefined);
          if (mismatches.length > 0) console.error(mismatches.join('\n'));
          expect(mismatches.length, `${mismatches.length} mismatches`).toBe(0);
        },
        TEST_TIMEOUT_MS,
      );
    }
  }
});

/* Returns a one-line mismatch report, or `undefined` when the input passes. */
function checkCase(c: Case): string | undefined {
  if (rustMode()) return frozen ? checkRustFrozen(c, frozen) : checkRustLive(c);
  return frozen ? checkTsFrozen(c, frozen) : checkTsStable(c);
}

function checkTsFrozen(c: Case, hashes: Map<string, string>): string | undefined {
  const expected = hashes.get(hashKey(c));
  if (expected === undefined) return report(c, 'no frozen hash');
  const actual = sha256(canonicalOutcome(run(c), c.input.source));
  if (actual === expected) return undefined;
  return report(c, `hash ${actual} != frozen ${expected}`);
}

function checkTsStable(c: Case): string | undefined {
  const first = run(c);
  const second = run(c);
  const source = c.input.source;
  if (canonicalOutcome(first, source) !== canonicalOutcome(second, source)) {
    return report(c, firstDivergentPath(first, second));
  }
  if (first.threw && !(first.value instanceof LiquidHTMLASTParsingError)) {
    return report(c, `threw ${describeThrow(first.value)}`);
  }
  return undefined;
}

function checkRustFrozen(c: Case, hashes: Map<string, string>): string | undefined {
  const expected = hashes.get(hashKey(c));
  if (expected === undefined) return report(c, 'no frozen hash');
  const rust = run(c);
  if (sha256(canonicalOutcome(rust, c.input.source)) === expected) return undefined;
  return report(
    c,
    firstDivergentPath(
      rust,
      withoutBackend(() => run(c)),
    ),
  );
}

function checkRustLive(c: Case): string | undefined {
  const rust = run(c);
  const ts = withoutBackend(() => run(c));
  const source = c.input.source;
  if (canonicalOutcome(rust, source) === canonicalOutcome(ts, source)) return undefined;
  return report(c, firstDivergentPath(rust, ts));
}

function run(c: Case): Outcome {
  try {
    const value =
      c.options === undefined ? c.parse(c.input.source) : c.parse(c.input.source, { ...c.options });
    return { threw: false, value };
  } catch (error) {
    return { threw: true, value: error };
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function hashKey(c: Case): string {
  return `${c.input.id}\t${c.entry}\t${c.config}`;
}

function loadHashes(file: string): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line === '') continue;
    const [id, entry, config, hash] = line.split('\t');
    hashes.set(`${id}\t${entry}\t${config}`, hash);
  }
  return hashes;
}

function report(c: Case, detail: string): string {
  return `MISMATCH ${c.input.id} ${c.entry} ${c.config}: ${detail}`;
}
