/**
 * JS character-rule parity between V8 and the Rust `js.rs` helpers.
 *
 * Usage: pnpx tsx scripts/rust-parity-js.ts
 *
 * A diagnostic for the Rust port, not a test file. Requires `build:rust`. Runs
 * every Unicode scalar value, U+0000 to U+10FFFF without the surrogates
 * U+D800 to U+DFFF, through the Rust test-only export `debug_js` and compares
 * each result with V8:
 * - `is_whitespace` with `/\s/`, `is_word` with `/\w/`, `is_digit` with `/\d/`,
 *   `is_ascii_alpha` with `/[a-zA-Z]/`, `is_line_terminator` with
 *   `/[\n\r\u2028\u2029]/`;
 * - `to_lower` with `s.toLowerCase()`, on every scalar and on context strings
 *   that exercise final sigma and multi-char lowering.
 *
 * Prints both Unicode versions, a count per op and the first 20 mismatches.
 * Exits 1 on any class-op mismatch. `to_lower` follows round 6 D13: exits 1
 * unless both Unicode versions equal `TO_LOWER_EXPECTED`, the mismatch set
 * equals its code points exactly, and no mismatch has an ASCII char in either
 * output.
 */
import wasmBase64 from '../rust/pkg/bytes.mjs';
import { debug_js, initSync } from '../rust/pkg/liquid_html_parser.js';

const CLASS_OPS: [string, RegExp][] = [
  ['is_whitespace', /\s/],
  ['is_word', /\w/],
  ['is_digit', /\d/],
  ['is_ascii_alpha', /[a-zA-Z]/],
  ['is_line_terminator', /[\n\r\u2028\u2029]/],
];

const TO_LOWER_CONTEXT = ['ΑΣ', 'Σ', 'ΑΣΑ', 'ΑΣ.', 'Α.Σ', 'ΑΣ\u0301', 'İ', 'ẞ', 'linK'];

const MISMATCHES_SHOWN = 20;

/* Round 6 D13: Unicode 17 capitals that V8 on Unicode 16 leaves unchanged. */
const TO_LOWER_EXPECTED = {
  v8Unicode: '16.0',
  rustUnicode: '17.0.0',
  codePoints: [
    0xa7ce, 0xa7d2, 0xa7d4, 0x16ea0, 0x16ea1, 0x16ea2, 0x16ea3, 0x16ea4, 0x16ea5, 0x16ea6, 0x16ea7,
    0x16ea8, 0x16ea9, 0x16eaa, 0x16eab, 0x16eac, 0x16ead, 0x16eae, 0x16eaf, 0x16eb0, 0x16eb1,
    0x16eb2, 0x16eb3, 0x16eb4, 0x16eb5, 0x16eb6, 0x16eb7, 0x16eb8,
  ],
};

interface Tally {
  op: string;
  inputs: number;
  /* Inputs where Rust and V8 differ. */
  mismatched: string[];
  /* Mismatched inputs with an ASCII char in either output. */
  asciiOutputs: string[];
}

function scalars(): string[] {
  const result: string[] = [];
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    result.push(String.fromCodePoint(cp));
  }
  return result;
}

function hex(s: string): string {
  return [...s]
    .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ');
}

function hasAscii(s: string): boolean {
  return [...s].some((c) => c.codePointAt(0)! < 0x80);
}

function compare(op: string, inputs: string[], expected: unknown[], shown: string[]): Tally {
  const rust: unknown[] = JSON.parse(debug_js(op, JSON.stringify(inputs)));
  const tally: Tally = { op, inputs: inputs.length, mismatched: [], asciiOutputs: [] };
  inputs.forEach((input, i) => {
    if (rust[i] === expected[i]) return;
    tally.mismatched.push(input);
    if (hasAscii(`${expected[i]}${rust[i]}`)) tally.asciiOutputs.push(input);
    if (shown.length >= MISMATCHES_SHOWN) return;
    shown.push(
      `MISMATCH ${op} ${hex(input)}: v8 ${JSON.stringify(expected[i])} rust ${JSON.stringify(rust[i])}`,
    );
  });
  return tally;
}

/* Round 6 D13 failures for `to_lower`, each as a printable line. */
function toLowerFailures(tally: Tally, v8Unicode: string, rustUnicode: string): string[] {
  const failures: string[] = [];
  if (v8Unicode !== TO_LOWER_EXPECTED.v8Unicode) {
    failures.push(`V8 Unicode ${v8Unicode}, expected ${TO_LOWER_EXPECTED.v8Unicode}`);
  }
  if (rustUnicode !== TO_LOWER_EXPECTED.rustUnicode) {
    failures.push(`Rust Unicode ${rustUnicode}, expected ${TO_LOWER_EXPECTED.rustUnicode}`);
  }
  const expected = new Set(TO_LOWER_EXPECTED.codePoints.map((cp) => String.fromCodePoint(cp)));
  const actual = new Set(tally.mismatched);
  const unexpected = tally.mismatched.filter((input) => !expected.has(input));
  const missing = [...expected].filter((input) => !actual.has(input));
  if (unexpected.length > 0)
    failures.push(`unexpected to_lower mismatches: ${unexpected.map(hex).join(', ')}`);
  if (missing.length > 0)
    failures.push(`expected to_lower mismatches missing: ${missing.map(hex).join(', ')}`);
  if (tally.asciiOutputs.length > 0) {
    failures.push(
      `to_lower mismatches with an ASCII output: ${tally.asciiOutputs.map(hex).join(', ')}`,
    );
  }
  return failures;
}

function main(): number {
  initSync({ module: Buffer.from(wasmBase64, 'base64') });
  const v8Unicode = process.versions.unicode ?? '';
  const [rustUnicode] = JSON.parse(debug_js('unicode_version', '[]'));
  console.log(`V8 Unicode ${v8Unicode}, Rust char::UNICODE_VERSION ${rustUnicode}`);

  const inputs = scalars();
  const shown: string[] = [];
  const classTallies = CLASS_OPS.map(([op, regex]) =>
    compare(
      op,
      inputs,
      inputs.map((s) => regex.test(s)),
      shown,
    ),
  );
  const lowerInputs = [...inputs, ...TO_LOWER_CONTEXT];
  const lowerTally = compare(
    'to_lower',
    lowerInputs,
    lowerInputs.map((s) => s.toLowerCase()),
    shown,
  );

  for (const tally of [...classTallies, lowerTally]) {
    console.log(`${tally.op}: ${tally.inputs} inputs, ${tally.mismatched.length} mismatches`);
  }
  for (const line of shown) console.log(line);
  const classMismatches = classTallies.reduce((sum, tally) => sum + tally.mismatched.length, 0);
  const failures = toLowerFailures(lowerTally, v8Unicode, rustUnicode);
  console.log(`Class-op mismatches: ${classMismatches}`);
  console.log(
    `to_lower: ${lowerTally.mismatched.length} mismatches, ${TO_LOWER_EXPECTED.codePoints.length} expected per round 6 D13`,
  );
  for (const failure of failures) console.log(`FAIL ${failure}`);
  return classMismatches === 0 && failures.length === 0 ? 0 : 1;
}

process.exit(main());
