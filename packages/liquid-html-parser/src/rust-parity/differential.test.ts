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
import { canonical } from './canonical';
import { loadNodeCorpus } from './corpus';
import type { CorpusInput } from './corpus';

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

interface Outcome {
  threw: boolean;
  value: unknown;
}

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

/* Calls the entry point with no backend registered, so the TS parser runs. */
function withoutBackend<T>(fn: () => T): T {
  const registry = globalThis as Record<symbol, unknown>;
  const saved = registry[BACKEND_KEY];
  delete registry[BACKEND_KEY];
  try {
    return fn();
  } finally {
    registry[BACKEND_KEY] = saved;
  }
}

/* Same encoding as scripts/freeze-baseline.ts, so the hashes are comparable. */
function canonicalOutcome(outcome: Outcome, source: string): string {
  return (outcome.threw ? 'threw:' : 'returned:') + canonical(outcome.value, source);
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

function describeThrow(error: unknown): string {
  const ctor = (error as { constructor?: { name?: string } })?.constructor?.name ?? typeof error;
  return `${ctor}: ${String((error as { message?: unknown })?.message ?? error)}`;
}

function firstDivergentPath(a: Outcome, b: Outcome): string {
  if (a.threw !== b.threw) {
    return `$ (${a.threw ? 'threw' : 'returned'} vs ${b.threw ? 'threw' : 'returned'}: ${
      a.threw ? describeThrow(a.value) : describeThrow(b.value)
    })`;
  }
  return divergentPath(a.value, b.value, '$') ?? '$ (aliasing or property descriptors)';
}

/* Walks both values in own key order and returns the first path where they differ. */
function divergentPath(a: unknown, b: unknown, at: string): string | undefined {
  if (Object.is(a, b)) return undefined;
  if (!isObject(a) || !isObject(b)) return `${at} (${preview(a)} vs ${preview(b)})`;
  if (protoName(a) !== protoName(b)) return `${at} (prototype ${protoName(a)} vs ${protoName(b)})`;

  const keysA = observableKeys(a);
  const keysB = observableKeys(b);
  for (let i = 0; i < Math.max(keysA.length, keysB.length); i++) {
    const key = keysA[i];
    if (key !== keysB[i]) {
      return `${at} (own key ${i}: ${String(key)} vs ${String(keysB[i])})`;
    }
    const child = divergentPath(Reflect.get(a, key), Reflect.get(b, key), childPath(at, a, key));
    if (child !== undefined) return child;
  }
  return undefined;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function observableKeys(value: object): (string | symbol)[] {
  return Reflect.ownKeys(value).filter((key) => key !== 'stack');
}

function childPath(at: string, parent: object, key: string | symbol): string {
  if (Array.isArray(parent) && typeof key === 'string' && key !== 'length') return `${at}[${key}]`;
  return `${at}.${String(key)}`;
}

function protoName(value: object): string {
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return 'null';
  return String(proto.constructor?.name ?? '<anonymous>');
}

function preview(value: unknown): string {
  const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
