/**
 * Marshalling gate: what it costs to move a full AST from Rust into JS objects.
 *
 * Usage:
 *   pnpx tsx scripts/marshal-gate.bench.ts --out <result.json>
 *   pnpx tsx scripts/marshal-gate.bench.ts --report <node.json> <chromium.json> --out <report.md>
 *
 * Needs `build:rust` and the fixture themes. Rust does not parse here. It
 * replays the TS-produced AST, already in the backend wire format, so only the
 * transfer is timed. `replay_load` runs outside the timed region.
 *
 * For each Horizon file, three paths are timed:
 * - (a) `replay_emit_json`, `JSON.parse`, `hydrate`
 * - (b) `replay_emit_object` (serde_wasm_bindgen), `hydrate`
 * - (c) TS `toLiquidHtmlAST`, as the reference
 * Each is the median of 20 warm runs, per file and for the whole corpus.
 *
 * Before timing, both emit paths must give canonical output equal to TS for
 * the 5 largest Horizon files by bytes.
 *
 * `runGate` takes the files as data, so the same code runs in Chromium.
 */
import { toLiquidHtmlAST } from '../src/index';
import { ALIAS_KEY, BACKEND_KEY, hydrate, UNDEFINED_KEY } from '../src/backend';
import { canonical } from '../src/rust-parity/canonical';
import '../rust/register.mjs';
import {
  replay_emit_json,
  replay_emit_object,
  replay_load,
} from '../rust/pkg/liquid_html_parser.js';

const WARMUP_RUNS = 5;
const TIMED_RUNS = 20;
const CHECKED_FILES = 5;
const SOURCE_KEYS = new Set(['source', '_source']);

export interface GateFile {
  path: string;
  source: string;
}

type Strategy = 'json' | 'object' | 'ts';

const STRATEGIES: Strategy[] = ['json', 'object', 'ts'];

export interface GateResult {
  runtime: string;
  files: number;
  bytes: number;
  checked: string[];
  corpusMs: Record<Strategy, number>;
  perFileMs: { path: string; bytes: number; ms: Record<Strategy, number> }[];
}

interface Prepared {
  file: GateFile;
  bytes: number;
  wire: string;
}

export function runGate(files: GateFile[], runtime: string): GateResult {
  const prepared = files.map(prepare);
  const checked = checkCanonical(prepared);

  for (let run = 0; run < WARMUP_RUNS; run++) timePass(prepared);
  const passes = Array.from({ length: TIMED_RUNS }, () => timePass(prepared));

  return {
    runtime,
    files: prepared.length,
    bytes: prepared.reduce((sum, p) => sum + p.bytes, 0),
    checked,
    corpusMs: strategyRecord((s) => median(passes.map((pass) => sum(pass.map((ms) => ms[s]))))),
    perFileMs: prepared.map((p, i) => ({
      path: p.file.path,
      bytes: p.bytes,
      ms: strategyRecord((s) => median(passes.map((pass) => pass[i][s]))),
    })),
  };
}

function prepare(file: GateFile): Prepared {
  const ast = withoutBackend(() => toLiquidHtmlAST(file.source));
  return {
    file,
    bytes: new TextEncoder().encode(file.source).length,
    wire: JSON.stringify(toWire(ast)),
  };
}

function checkCanonical(prepared: Prepared[]): string[] {
  const largest = [...prepared].sort((a, b) => b.bytes - a.bytes).slice(0, CHECKED_FILES);
  for (const p of largest) checkFile(p);
  return largest.map((p) => p.file.path);
}

function checkFile({ file, wire }: Prepared) {
  const expected = canonical(
    withoutBackend(() => toLiquidHtmlAST(file.source)),
    file.source,
  );
  replay_load(wire);
  const viaJson = canonical(hydrate(JSON.parse(replay_emit_json()), file.source), file.source);
  const viaObject = canonical(hydrate(replay_emit_object(), file.source), file.source);
  if (viaJson !== expected) throw new Error(`JSON path differs from TS for ${file.path}`);
  if (viaObject !== expected) throw new Error(`object path differs from TS for ${file.path}`);
}

function timePass(prepared: Prepared[]): Record<Strategy, number>[] {
  return prepared.map(({ file, wire }) => {
    replay_load(wire);
    return {
      json: time(() => hydrate(JSON.parse(replay_emit_json()), file.source)),
      object: time(() => hydrate(replay_emit_object(), file.source)),
      ts: time(() => withoutBackend(() => toLiquidHtmlAST(file.source))),
    };
  });
}

/*
 * The wire format of Phase 3 decision D1: `undefined` and repeated objects
 * become marker objects, and `source` keys carry a placeholder. Aliases index
 * objects and arrays in pre-order, own key order, counting no markers.
 */
function toWire(ast: unknown): unknown {
  const seen = new Map<object, number>();
  const encode = (value: unknown, key?: string): unknown => {
    if (key !== undefined && SOURCE_KEYS.has(key)) return 0;
    if (value === undefined) return { [UNDEFINED_KEY]: 0 };
    if (value === null || typeof value !== 'object') return value;
    const index = seen.get(value);
    if (index !== undefined) return { [ALIAS_KEY]: index };

    seen.set(value, seen.size);
    if (Array.isArray(value)) return value.map((item) => encode(item));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v, k)]));
  };
  return encode(ast);
}

/*
 * `register.mjs` installs the Rust backend, and the TS reference must not go
 * through it.
 */
function withoutBackend<T>(fn: () => T): T {
  const global = globalThis as Record<symbol, unknown>;
  const backend = global[BACKEND_KEY];
  delete global[BACKEND_KEY];
  try {
    return fn();
  } finally {
    global[BACKEND_KEY] = backend;
  }
}

function time(fn: () => unknown): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function strategyRecord(fn: (s: Strategy) => number): Record<Strategy, number> {
  return Object.fromEntries(STRATEGIES.map((s) => [s, fn(s)])) as Record<Strategy, number>;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/*
 * Decision rule from the plan: use (a) JSON unless (b) is at least 20% faster
 * on the whole corpus in Node and not slower in Chromium.
 */
export function chooseStrategy(node: GateResult, chromium: GateResult): Strategy {
  const nodeGain = (node.corpusMs.json - node.corpusMs.object) / node.corpusMs.json;
  const chromiumNotSlower = chromium.corpusMs.object <= chromium.corpusMs.json;
  return nodeGain >= 0.2 && chromiumNotSlower ? 'object' : 'json';
}

export function formatReport(node: GateResult, chromium: GateResult): string {
  const chosen = chooseStrategy(node, chromium);
  const nodeGain = (node.corpusMs.json - node.corpusMs.object) / node.corpusMs.json;
  const fmt = (ms: number) => ms.toFixed(2);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const ratio = (r: GateResult, s: Strategy) => (r.corpusMs[s] / r.corpusMs.ts).toFixed(2);
  const corpusRow = (r: GateResult) =>
    `| ${r.runtime} | ${r.files} | ${r.bytes} | ${fmt(r.corpusMs.json)} | ${fmt(r.corpusMs.object)} | ${fmt(r.corpusMs.ts)} | ${ratio(r, 'json')} | ${ratio(r, 'object')} |`;
  const chromiumByPath = new Map(chromium.perFileMs.map((f) => [f.path, f.ms]));
  const fileRow = (f: GateResult['perFileMs'][number]) => {
    const c = chromiumByPath.get(f.path);
    const cells = c ? [c.json, c.object, c.ts].map(fmt).join(' | ') : '- | - | -';
    return `| ${f.path} | ${f.bytes} | ${fmt(f.ms.json)} | ${fmt(f.ms.object)} | ${fmt(f.ms.ts)} | ${cells} |`;
  };
  const cheaper = (r: GateResult) => Math.min(r.corpusMs.json, r.corpusMs.object);
  const overTwice = [node, chromium].filter((r) => cheaper(r) > 2 * r.corpusMs.ts);

  return [
    '# Marshalling gate',
    '',
    `Chosen strategy: **${chosen === 'json' ? '(a) JSON string' : '(b) serde_wasm_bindgen objects'}**.`,
    '',
    `Rule: (b) wins only if it is at least 20% faster than (a) on the whole corpus in Node and not slower in Chromium. Node gain of (b) over (a): **${pct(nodeGain)}**. Chromium (b) not slower than (a): **${chromium.corpusMs.object <= chromium.corpusMs.json}**.`,
    '',
    '## Whole Horizon corpus, median of 20 warm runs, ms',
    '',
    '| Runtime | Files | Bytes | (a) JSON | (b) object | (c) TS parse | (a)/(c) | (b)/(c) |',
    '|---|---|---|---|---|---|---|---|',
    corpusRow(node),
    corpusRow(chromium),
    '',
    overTwice.length
      ? `Known cost: the cheaper strategy exceeds 2x the TS parse time in ${overTwice.map((r) => r.runtime).join(' and ')}. Recorded, not acted on, per the plan.`
      : 'The cheaper strategy is within 2x the TS parse time in both runtimes.',
    '',
    `Canonical check before timing, 5 largest files by bytes, both emit paths equal to TS in both runtimes: ${node.checked.join(', ')}.`,
    '',
    '## Per file, median of 20 warm runs, ms',
    '',
    '| File | Bytes | Node (a) | Node (b) | Node (c) | Chromium (a) | Chromium (b) | Chromium (c) |',
    '|---|---|---|---|---|---|---|---|',
    ...node.perFileMs.map(fileRow),
    '',
  ].join('\n');
}

async function nodeMain(argv: string[]) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const out = argv[argv.indexOf('--out') + 1];
  if (!argv.includes('--out') || !out) throw new Error('--out <file> is required');

  if (argv.includes('--report')) {
    const at = argv.indexOf('--report');
    const read = (file: string): GateResult => JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(out, formatReport(read(argv[at + 1]), read(argv[at + 2])));
    return;
  }

  const result = runGate(
    readHorizon(fs, path, path.join(pkg, 'fixtures', 'theme')),
    `Node ${process.version}`,
  );
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(
    JSON.stringify({ runtime: result.runtime, files: result.files, corpusMs: result.corpusMs }),
  );
}

function readHorizon(
  fs: typeof import('node:fs'),
  path: typeof import('node:path'),
  themeDir: string,
): GateFile[] {
  const root = path.join(themeDir, 'horizon');
  const files = (fs.readdirSync(root, { recursive: true }) as string[])
    .filter((rel) => rel.endsWith('.liquid'))
    .map((rel) => ({
      path: `horizon/${rel.split(path.sep).join('/')}`,
      source: fs.readFileSync(path.join(root, rel), 'utf8'),
    }));
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// `pnpx tsx` compiles this file to CommonJS, which rejects top-level await
const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;
if (nodeProcess?.argv[1]?.endsWith('marshal-gate.bench.ts')) {
  nodeMain(nodeProcess.argv.slice(2)).catch((error) => {
    console.error(error);
    nodeProcess.exit(1);
  });
}
