/**
 * Token parity between the TS tokenizers and their Rust ports.
 *
 * Usage: pnpx tsx scripts/rust-parity-tokens.ts
 *
 * A diagnostic for the Rust port, not a test file. Requires `build:rust`. Runs
 * every corpus input through:
 * - `tokenize` with each of the 5 option sets the parser passes;
 * - `tokenizeMarkup` on the whole input, at `startOffset` 0 and 7.
 * Each result is compared token by token with the Rust test-only exports
 * `debug_tokenize` and `debug_tokenize_markup`.
 *
 * Prints input id, options, and the first differing token of every mismatch,
 * then a count per option set. Exits 1 on any mismatch.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize } from "../src/document/tokenizer";
import type { TokenizeOptions } from "../src/document/tokenizer";
import { tokenizeMarkup } from "../src/markup/tokenizer";
import { loadNodeCorpus } from "../src/rust-parity/corpus";
import type { CorpusInput } from "../src/rust-parity/corpus";
import wasmBase64 from "../rust/pkg/bytes.mjs";
import { debug_tokenize, debug_tokenize_markup, initSync } from "../rust/pkg/liquid_html_parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");

const TOKENIZE_OPTIONS: TokenizeOptions[] = [
  {},
  { skipFrontmatter: true },
  { skipFrontmatter: true, insideQuotedAttribute: '"' },
  { skipFrontmatter: true, insideQuotedAttribute: "'" },
  { skipFrontmatter: true, insideHtmlTag: true },
];

const MARKUP_OFFSETS = [0, 7];

interface Check {
  label: string;
  ts: (source: string) => unknown[];
  rust: (source: string) => unknown[];
}

interface Tally {
  label: string;
  inputs: number;
  tokens: number;
  mismatches: number;
}

function tokenizeChecks(): Check[] {
  return TOKENIZE_OPTIONS.map((options) => ({
    label: `tokenize ${JSON.stringify(options)}`,
    ts: (source) => tokenize(source, { ...options }),
    rust: (source) =>
      JSON.parse(
        debug_tokenize(
          source,
          options.skipFrontmatter ?? false,
          options.insideQuotedAttribute,
          options.insideHtmlTag ?? false,
        ),
      ),
  }));
}

function markupChecks(): Check[] {
  return MARKUP_OFFSETS.map((startOffset) => ({
    label: `tokenizeMarkup startOffset ${startOffset}`,
    ts: (source) => tokenizeMarkup(source, startOffset),
    rust: (source) => JSON.parse(debug_tokenize_markup(source, startOffset)),
  }));
}

/* The index of the first token that differs, or -1 when the streams agree. */
function firstDifference(ts: unknown[], rust: unknown[]): number {
  const length = Math.max(ts.length, rust.length);
  for (let i = 0; i < length; i++) {
    if (JSON.stringify(ts[i]) !== JSON.stringify(rust[i])) return i;
  }
  return -1;
}

function runCheck(check: Check, corpus: CorpusInput[]): Tally {
  const tally: Tally = { label: check.label, inputs: corpus.length, tokens: 0, mismatches: 0 };
  for (const input of corpus) {
    const ts = check.ts(input.source);
    const rust = check.rust(input.source);
    tally.tokens += ts.length;
    const at = firstDifference(ts, rust);
    if (at === -1) continue;
    tally.mismatches++;
    console.log(
      `MISMATCH ${input.id} ${check.label} token ${at}: ts ${JSON.stringify(ts[at])} rust ${JSON.stringify(rust[at])}`,
    );
  }
  return tally;
}

async function main(): Promise<number> {
  initSync({ module: Buffer.from(wasmBase64, "base64") });
  const corpus = await loadNodeCorpus(PKG);
  console.log(`Token parity corpus: ${corpus.length} inputs`);

  const tallies = [...tokenizeChecks(), ...markupChecks()].map((check) => runCheck(check, corpus));
  for (const tally of tallies) {
    console.log(`${tally.label}: ${tally.inputs} inputs, ${tally.tokens} TS tokens, ${tally.mismatches} mismatches`);
  }
  const mismatches = tallies.reduce((sum, tally) => sum + tally.mismatches, 0);
  console.log(`Total mismatches: ${mismatches}`);
  return mismatches === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
