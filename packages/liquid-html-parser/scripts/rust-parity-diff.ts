/**
 * Compare the TS and Rust parsers on one corpus input, entry point, and config.
 *
 * Usage: pnpx tsx scripts/rust-parity-diff.ts <input-id> <entry> <config>
 *
 * <input-id> is a corpus id as printed by the differential test, for example
 * `theme/dawn/sections/header.liquid#cut3of20`. <entry> is one of liquidHtml,
 * liquid, tolerantLiquidHtml, tolerantLiquid. <config> is one of default,
 * closed, unclosed, strict, completion. Requires `build:rust`.
 *
 * Prints both canonical hashes, the frozen hash when
 * fixtures/golden-canonical/hashes.tsv exists, and the first divergent path.
 * Exits 1 when the two parsers differ, or when Rust differs from the frozen hash.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toLiquidAST,
  toLiquidHtmlAST,
  toTolerantLiquidAST,
  toTolerantLiquidHtmlAST,
} from '../src/index';
import type { ASTBuildOptions } from '../src/index';
import { loadNodeCorpus } from '../src/rust-parity/corpus';
import { canonicalOutcome, firstDivergentPath, withoutBackend } from '../src/rust-parity/outcome';
import type { Outcome } from '../src/rust-parity/outcome';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, '..');
const HASHES_FILE = path.join(PKG, 'fixtures', 'golden-canonical', 'hashes.tsv');
const USAGE = 'Usage: pnpx tsx scripts/rust-parity-diff.ts <input-id> <entry> <config>';

type Parse = (source: string, options?: ASTBuildOptions) => unknown;

const ENTRIES: Record<string, Parse> = {
  liquidHtml: toLiquidHtmlAST,
  liquid: toLiquidAST,
  tolerantLiquidHtml: toTolerantLiquidHtmlAST,
  tolerantLiquid: toTolerantLiquidAST,
};

const CONFIGS: Record<string, ASTBuildOptions | undefined> = {
  default: undefined,
  closed: { allowUnclosedDocumentNode: false, mode: 'tolerant' },
  unclosed: { allowUnclosedDocumentNode: true, mode: 'tolerant' },
  strict: { allowUnclosedDocumentNode: false, mode: 'strict' },
  completion: { allowUnclosedDocumentNode: true, mode: 'completion' },
};

function run(parse: Parse, source: string, options: ASTBuildOptions | undefined): Outcome {
  try {
    const value = options === undefined ? parse(source) : parse(source, { ...options });
    return { threw: false, value };
  } catch (error) {
    return { threw: true, value: error };
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function frozenHash(id: string, entry: string, config: string): string | undefined {
  if (!fs.existsSync(HASHES_FILE)) return undefined;
  const prefix = `${id}\t${entry}\t${config}\t`;
  const line = fs
    .readFileSync(HASHES_FILE, 'utf8')
    .split('\n')
    .find((candidate) => candidate.startsWith(prefix));
  return line?.slice(prefix.length);
}

async function main(): Promise<number> {
  const [id, entry, config, ...rest] = process.argv.slice(2);
  const parse = ENTRIES[entry];
  if (!id || !parse || !(config in CONFIGS) || rest.length > 0) {
    console.error(USAGE);
    return 2;
  }

  const corpus = await loadNodeCorpus(PKG);
  const input = corpus.find((candidate) => candidate.id === id);
  if (!input) {
    console.error(`No corpus input with id ${id}`);
    return 2;
  }

  await import('../rust/register.mjs');
  const options = CONFIGS[config];
  const rust = run(parse, input.source, options);
  const ts = withoutBackend(() => run(parse, input.source, options));
  const rustHash = sha256(canonicalOutcome(rust, input.source));
  const tsHash = sha256(canonicalOutcome(ts, input.source));
  const frozen = frozenHash(id, entry, config);

  console.log(`input   ${id}\nentry   ${entry}\nconfig  ${config}`);
  console.log(`ts      ${tsHash}\nrust    ${rustHash}\nfrozen  ${frozen ?? '(no goldens)'}`);
  const same = rustHash === tsHash && (frozen === undefined || rustHash === frozen);
  if (same) {
    console.log('MATCH');
    return 0;
  }
  console.log(`MISMATCH first divergent path: ${firstDivergentPath(rust, ts)}`);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
