/**
 * Vitest setup file that selects the parser backend from `LIQUID_PARSER`.
 *
 * - `ts` or unset: nothing happens, the TS parser runs.
 * - `rust`: registers the Rust backend and, on exit, appends its counters as
 *   one JSON line to `$LIQUID_PARSER_STATS`.
 * - anything else throws, so a typo can never turn a Rust run into a TS run.
 */
import * as fs from 'node:fs';
import { BACKEND_KEY, type ParserBackend } from '../backend';

/*
 * A path held in a variable keeps tsc from resolving a file that only exists
 * after `build:rust`.
 */
const registerPath = '../../rust/register.mjs';

/*
 * Vitest runs setup files before every test file, and test files can share one
 * process. Mark the process so each worker writes its counters only once.
 */
const statsWriterInstalled = Symbol.for('@shopify/liquid-html-parser/statsWriter');

const mode = process.env.LIQUID_PARSER ?? 'ts';

if (mode !== 'ts' && mode !== 'rust') {
  throw new Error(`LIQUID_PARSER must be "ts" or "rust", got "${mode}"`);
}

// @ts-expect-error tsc's `module: commonjs` rejects top-level await; vitest runs this file as ESM
if (mode === 'rust') await registerRustBackend();

async function registerRustBackend() {
  await import(registerPath);
  const backend = (globalThis as Record<symbol, ParserBackend | undefined>)[BACKEND_KEY];
  if (!backend) throw new Error('LIQUID_PARSER=rust but rust/register.mjs registered no backend');
  installStatsWriter(backend);
}

function installStatsWriter(backend: ParserBackend) {
  const statsPath = process.env.LIQUID_PARSER_STATS;
  if (!statsPath || Reflect.get(process, statsWriterInstalled)) return;

  Reflect.set(process, statsWriterInstalled, true);
  let written = false;
  const write = () => {
    if (written) return;
    written = true;
    fs.appendFileSync(statsPath, JSON.stringify(backend.stats) + '\n');
  };

  process.on('exit', write);
  // Vitest stops fork workers with SIGTERM, which skips 'exit', so write and then re-raise it
  process.once('SIGTERM', () => {
    write();
    process.kill(process.pid, 'SIGTERM');
  });
}
