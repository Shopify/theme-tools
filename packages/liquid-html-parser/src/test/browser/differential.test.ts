/*
 * TS-vs-Rust differential parity test, run in Chromium.
 *
 * The browser copy of `src/rust-parity/differential.test.ts`. It has the same
 * 20 test names, and it runs only the live check: canonical(rust) must equal
 * canonical(ts) from the same browser. There is no fs here, so themes come
 * from `fixtures/theme-bundle.ts` and prettier fixtures from a Vite glob.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  toLiquidAST,
  toLiquidHtmlAST,
  toTolerantLiquidAST,
  toTolerantLiquidHtmlAST,
} from '../../index';
import type { ASTBuildOptions } from '../../index';
import { BACKEND_KEY } from '../../backend';
import type { BackendStats, ParserBackend } from '../../backend';
import { loadBrowserCorpus } from '../../rust-parity/corpus';
import type { CorpusInput } from '../../rust-parity/corpus';
import { canonicalOutcome, firstDivergentPath, withoutBackend } from '../../rust-parity/outcome';
import type { Outcome } from '../../rust-parity/outcome';

const PRETTIER_PREFIX = '../../../../prettier-plugin-liquid/src/test/';

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

const registeredBackend = () =>
  (globalThis as Record<symbol, ParserBackend | undefined>)[BACKEND_KEY];

beforeAll(async () => {
  if (registeredBackend() === undefined) {
    throw new Error('Chromium differential: no Rust backend registered');
  }
  corpus = await loadBrowserCorpus(prettierFixtures());
  console.log(`Browser differential corpus: ${corpus.length} inputs`);
});

describe('TS vs Rust differential', () => {
  for (const [entry, parse] of ENTRIES) {
    for (const [config, options] of CONFIGS) {
      it(
        `${entry} ${config}`,
        () => {
          const before = snapshotStats();
          const mismatches = corpus
            .map((input) => checkRustLive({ input, entry, config, parse, options }))
            .filter((line): line is string => line !== undefined);
          const after = snapshotStats();
          if (mismatches.length > 0) console.error(mismatches.join('\n'));
          expect(mismatches.length, `${mismatches.length} mismatches`).toBe(0);
          expect(after.parses - before.parses, 'Rust parses').toBe(corpus.length);
          expect(after.fallbacks.environment - before.fallbacks.environment).toBe(0);
          expect(after.fallbacks.illFormed - before.fallbacks.illFormed).toBe(0);
        },
        TEST_TIMEOUT_MS,
      );
    }
  }
});

function prettierFixtures(): { path: string; source: string }[] {
  const modules: Record<string, string> =
    // @ts-expect-error tsc's `module: commonjs` rejects import.meta; vitest runs this file as ESM
    import.meta.glob('../../../../prettier-plugin-liquid/src/test/**/{index,fixed}.liquid', {
      query: '?raw',
      import: 'default',
      eager: true,
    });
  return Object.entries(modules).map(([key, source]) => ({
    path: key.slice(PRETTIER_PREFIX.length),
    source,
  }));
}

function snapshotStats(): BackendStats {
  const { stats } = registeredBackend()!;
  return { parses: stats.parses, fallbacks: { ...stats.fallbacks } };
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

function report(c: Case, detail: string): string {
  return `MISMATCH ${c.input.id} ${c.entry} ${c.config}: ${detail}`;
}
