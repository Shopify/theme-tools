/**
 * Freeze the TS parser baseline for the Rust parity work.
 *
 * Usage: pnpx tsx scripts/freeze-baseline.ts [--out <dir>] [--stats <file>]
 *
 * Parses every corpus input with each of the 4 entry points under each of the
 * 5 option configs, using the TS parser from src/. Writes into <dir>
 * (default fixtures/golden-canonical/):
 * - hashes.tsv: `id<TAB>entry<TAB>config<TAB>sha256(canonical)`, one line per parse
 * - full/<entry>/<id>.txt: the full canonical string, `default` config, whole files only
 *
 * With --stats, also writes corpus stats that decide the Rust boundary details.
 * Output is deterministic: two runs give byte-identical files.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LiquidHTMLASTParsingError,
  toLiquidAST,
  toLiquidHtmlAST,
  toTolerantLiquidAST,
  toTolerantLiquidHtmlAST,
} from '../src/index';
import type { ASTBuildOptions } from '../src/index';
import { canonical } from '../src/rust-parity/canonical';
import { countCorpus, loadNodeCorpus } from '../src/rust-parity/corpus';
import type { CorpusInput } from '../src/rust-parity/corpus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(PKG, 'fixtures', 'golden-canonical');

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

interface Stats {
  parses: number;
  parsesOk: number;
  parsesThrew: number;
  parserThrows: number;
  ownKeysWithUndefinedValue: number;
  undefinedValueKeys: Record<string, number>;
  aliasedObjects: number;
  aliasedReferences: number;
  aliasedKeys: Record<string, number>;
  nonPlainPrototypes: number;
  nonPlainPrototypeNames: Record<string, number>;
  nodesWithSourceNotInput: number;
  nonParserThrows: { id: string; entry: string; config: string; ctor: string; message: string }[];
  inputsWithNonAscii: number;
  wholeFilesWithNonAscii: number;
  inputsNotWellFormed: number;
  wholeFilesNotWellFormed: number;
}

function parseArgs(argv: string[]): { out: string; stats?: string } {
  const args: { out: string; stats?: string } = { out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    if (flag === '--out') args.out = path.resolve(value);
    else if (flag === '--stats') args.stats = path.resolve(value);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

function run(parse: Parse, source: string, options: ASTBuildOptions | undefined): Outcome {
  try {
    const value = options === undefined ? parse(source) : parse(source, { ...options });
    return { threw: false, value };
  } catch (error) {
    return { threw: true, value: error };
  }
}

function canonicalOutcome(outcome: Outcome, source: string): string {
  return (outcome.threw ? 'threw:' : 'returned:') + canonical(outcome.value, source);
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function emptyStats(): Stats {
  return {
    parses: 0,
    parsesOk: 0,
    parsesThrew: 0,
    parserThrows: 0,
    ownKeysWithUndefinedValue: 0,
    undefinedValueKeys: {},
    aliasedObjects: 0,
    aliasedReferences: 0,
    aliasedKeys: {},
    nonPlainPrototypes: 0,
    nonPlainPrototypeNames: {},
    nodesWithSourceNotInput: 0,
    nonParserThrows: [],
    inputsWithNonAscii: 0,
    wholeFilesWithNonAscii: 0,
    inputsNotWellFormed: 0,
    wholeFilesNotWellFormed: 0,
  };
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function isPlain(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || (Array.isArray(value) && proto === Array.prototype);
}

function protoLabel(value: object): string {
  const proto = Object.getPrototypeOf(value);
  return proto === null ? 'null' : String(proto.constructor?.name ?? '<anonymous>');
}

/* Walks every own key of the returned AST and records the stats the boundary depends on. */
function collectAstStats(root: unknown, source: string, stats: Stats): void {
  const seen = new Set<object>();
  const aliased = new Set<object>();

  const visit = (value: unknown, key: string): void => {
    if (typeof value !== 'object' || value === null) return;
    if (seen.has(value)) {
      stats.aliasedReferences++;
      bump(stats.aliasedKeys, key);
      if (!aliased.has(value)) aliased.add(value);
      return;
    }
    seen.add(value);
    recordObject(value, source, stats);
    for (const childKey of Reflect.ownKeys(value)) {
      if (typeof childKey !== 'string') continue;
      visit((value as any)[childKey], childKey);
    }
  };

  visit(root, '$');
  stats.aliasedObjects += aliased.size;
}

function recordObject(value: object, source: string, stats: Stats): void {
  if (!isPlain(value)) {
    stats.nonPlainPrototypes++;
    bump(stats.nonPlainPrototypeNames, protoLabel(value));
  }
  const sourceKeyMismatch = ['source', '_source'].some(
    (key) => Object.prototype.hasOwnProperty.call(value, key) && (value as any)[key] !== source,
  );
  if (sourceKeyMismatch) stats.nodesWithSourceNotInput++;
  if (Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if ((value as any)[key] !== undefined) continue;
    stats.ownKeysWithUndefinedValue++;
    bump(stats.undefinedValueKeys, key);
  }
}

function recordThrow(
  error: unknown,
  input: CorpusInput,
  entry: string,
  config: string,
  stats: Stats,
): void {
  stats.parsesThrew++;
  if (error instanceof LiquidHTMLASTParsingError) {
    stats.parserThrows++;
    return;
  }
  const ctor = (error as any)?.constructor?.name ?? typeof error;
  const message = String((error as any)?.message ?? error);
  stats.nonParserThrows.push({ id: input.id, entry, config, ctor, message });
}

function recordInput(input: CorpusInput, stats: Stats): void {
  const nonAscii = /[^\x00-\x7f]/.test(input.source);
  const wellFormed = (input.source as any).isWellFormed() as boolean;
  if (nonAscii) stats.inputsWithNonAscii++;
  if (nonAscii && input.whole) stats.wholeFilesWithNonAscii++;
  if (!wellFormed) stats.inputsNotWellFormed++;
  if (!wellFormed && input.whole) stats.wholeFilesNotWellFormed++;
}

function writeFull(out: string, entry: string, id: string, text: string): void {
  const file = path.join(out, 'full', entry, `${id}.txt`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function freezeInput(input: CorpusInput, out: string, lines: string[], stats: Stats): void {
  recordInput(input, stats);
  for (const [entry, parse] of ENTRIES) {
    for (const [config, options] of CONFIGS) {
      const outcome = run(parse, input.source, options);
      const text = canonicalOutcome(outcome, input.source);
      lines.push(`${input.id}\t${entry}\t${config}\t${sha256(text)}`);
      stats.parses++;
      if (outcome.threw) recordThrow(outcome.value, input, entry, config, stats);
      else {
        stats.parsesOk++;
        collectAstStats(outcome.value, input.source, stats);
      }
      if (config === 'default' && input.whole) writeFull(out, entry, input.id, text);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const corpus = await loadNodeCorpus(PKG);
  const counts = countCorpus(corpus);
  console.log('Corpus counts:', JSON.stringify(counts));
  const expected =
    (counts.themeFiles + counts.prettierFiles) * (1 + counts.prefixCutsPerFile) +
    counts.errorCorpusFiles;
  console.log(
    `Expected (themes + prettier) x (1 + ${counts.prefixCutsPerFile}) + error-corpus = ${expected}`,
  );
  if (expected !== counts.total)
    throw new Error(`Corpus count ${counts.total} != expected ${expected}`);

  fs.rmSync(args.out, { recursive: true, force: true });
  fs.mkdirSync(args.out, { recursive: true });

  const stats = emptyStats();
  const lines: string[] = [];
  for (const input of corpus) freezeInput(input, args.out, lines, stats);
  fs.writeFileSync(path.join(args.out, 'hashes.tsv'), lines.join('\n') + '\n');
  console.log(`Wrote ${lines.length} hashes to ${path.join(args.out, 'hashes.tsv')}`);

  if (!args.stats) return;
  const report = { nodeVersion: process.version, corpus: counts, ...stats };
  fs.mkdirSync(path.dirname(args.stats), { recursive: true });
  fs.writeFileSync(args.stats, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote stats to ${args.stats}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
