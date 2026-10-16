/**
 * Markup parity between the TS markup parser and tags and their Rust ports.
 *
 * Usage: pnpx tsx scripts/rust-parity-markup.ts [--mode tags|doc]
 *
 * A diagnostic for the Rust port, not a test file. Requires `build:rust`.
 * With no `--mode`, runs every mode. Tag mode runs each builtin tag except
 * `liquid` through the TS `MarkupParser` and the Rust test-only export
 * `debug_parse_tag`, with `tolerant` false and true, on:
 * - real tags: every `{% name markup %}` in the whole corpus inputs, deduped
 *   on (name, markup);
 * - truncations: each real tag cut at the end of each markup token but the
 *   last;
 * - synthetic entries: one per throw site, each first checked to throw the
 *   expected error in TS, plus one valid entry for a tag with no real input;
 * - probe entries: one per sharing site and per `Object.prototype` key, each
 *   first checked to reach its site in TS.
 * Doc mode runs the TS `parseLiquidDoc` and the Rust test-only export
 * `debug_parse_liquid_doc` on every body between a `doc` tag and the next
 * `enddoc` tag, found as in tag mode, and on every whole input as one body.
 * Corpus inputs that are not well-formed UTF-16 are skipped, because the
 * backend never sends them to Rust.
 *
 * The canonical outcomes must be equal. Prints input id, tag, tolerant, markup
 * and the first divergent path of every mismatch, then counts per tag, per
 * mode, per input class and per synthetic or probe site. Doc mode prints the
 * same per input class. Exits 1 on any mismatch or failed expectation.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hydrate, type BackendError, type BackendResult } from '../src/backend';
import { tokenize, TokenType } from '../src/document/tokenizer';
import { LiquidHTMLASTParsingError, type UnclosedNode } from '../src/errors';
import { parseLiquidDoc } from '../src/liquid-doc/parser';
import { MarkupParser } from '../src/markup/parser';
import { MarkupTokenType, tokenizeMarkup } from '../src/markup/tokenizer';
import { loadNodeCorpus } from '../src/rust-parity/corpus';
import {
  canonicalOutcome,
  firstDivergentPath,
  nodesOf,
  type Outcome,
} from '../src/rust-parity/outcome';
import type { Parser, TagDefinition } from '../src/tag-definitions';
import { builtinTags } from '../src/tags';
import wasmBase64 from '../rust/pkg/bytes.mjs';
import { debug_parse_liquid_doc, debug_parse_tag, initSync } from '../rust/pkg/liquid_html_parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, '..');

const TAGS = builtinTags as Record<string, TagDefinition>;
const TAG_NAMES = Object.keys(builtinTags).filter((name) => name !== 'liquid');

type InputClass = 'real' | 'truncation' | 'synthetic';

interface TagInput {
  id: string;
  inputClass: InputClass;
  site?: string;
  tag: string;
  source: string;
  markupStart: number;
  markupEnd: number;
}

interface Expect {
  ctor: string;
  message: string;
}

type ProbeCheck =
  | { kind: 'hasAlias' }
  | { kind: 'hasLiteral'; key: string }
  | { kind: 'hasLookup'; name: string };

/* A throw site entry, a site TS cannot reach, or a probe that TS must reach. */
type SyntheticEntry =
  | { site: string; tag: string; markup: string; expect: Expect }
  | { site: string; unreachable: string }
  | { site: string; tag: string; markup: string; check: ProbeCheck; why: string };

type ProbeEntry = Extract<SyntheticEntry, { check: ProbeCheck }>;

const PARSING_ERROR = 'LiquidHTMLASTParsingError';

const SYNTHETIC: SyntheticEntry[] = [
  { site: 'markup/parser.ts:208', tag: 'for', markup: '1 in x', expect: { ctor: PARSING_ERROR, message: 'Expected Id but found Number (1)' } },
  { site: 'markup/parser.ts:420', tag: 'layout', markup: '.x', expect: { ctor: PARSING_ERROR, message: 'Expected expression but found Dot (.)' } },
  { site: 'markup/parser.ts:482', tag: 'layout', markup: '-', expect: { ctor: PARSING_ERROR, message: 'Expected expression but found Dash (-)' } },
  { site: 'markup/parser.ts:490', tag: 'layout', markup: ',', expect: { ctor: PARSING_ERROR, message: 'Expected expression but found Comma (,)' } },
  { site: 'markup/parser.ts:546', tag: 'increment', markup: '1', expect: { ctor: PARSING_ERROR, message: 'Expected identifier or [ but found Number (1)' } },
  { site: 'markup/parser.ts:876', tag: 'if', markup: 'a = b', expect: { ctor: PARSING_ERROR, message: 'Unknown operator =' } },
  {
    site: 'markup/parser.ts:1113',
    unreachable:
      'the markup tokenizer emits a Logical token only for the values `and` and `or` (src/markup/tokenizer.ts:110), and both are logical operators, so `isLogicalOp` is never false',
  },
  { site: 'markup/parser.ts:1381', tag: 'section', markup: "'x', a: [[1]]", expect: { ctor: PARSING_ERROR, message: 'nested arrays are not supported in block array literal' } },
  { site: 'tags/block.ts:14', tag: 'block', markup: '', expect: { ctor: 'Error', message: "in 'block' - missing block type" } },
  { site: 'tags/block.ts:19', tag: 'block', markup: 'x', expect: { ctor: 'Error', message: "in 'block' - file name must be a string literal" } },
  { site: 'tags/block.ts:22', tag: 'block', markup: "'a b'", expect: { ctor: 'Error', message: "in 'block' - 'a b' is not a valid block type" } },
  { site: 'tags/block.ts:32', tag: 'block', markup: "'a' 'b'", expect: { ctor: 'Error', message: "Unexpected token in 'block' tag: 'b'" } },
  {
    site: 'tags/assign.ts:30',
    unreachable:
      'inside `if (markup.isLax())`; only liquid-render-tree lax recovery enables lax, which stays TS-only, so neither the document parser nor this script reaches it',
  },
  { site: 'tags/assign.ts:37', tag: 'assign', markup: 'x == 1', expect: { ctor: 'Error', message: "Expected '=' in assign tag" } },
  { site: 'tags/break.ts:8', tag: 'break', markup: 'x', expect: { ctor: 'Error', message: "'break' tag does not accept markup" } },
  { site: 'tags/continue.ts:8', tag: 'continue', markup: 'x', expect: { ctor: 'Error', message: "'continue' tag does not accept markup" } },
  { site: 'tags/raw.ts:6', tag: 'raw', markup: 'x', expect: { ctor: 'Error', message: "'raw' tag does not accept markup" } },
  { site: 'tags/for.ts:10', tag: 'for', markup: 'x', expect: { ctor: 'Error', message: "Expected 'in'" } },
  { site: 'tags/paginate.ts:14', tag: 'paginate', markup: 'x', expect: { ctor: 'Error', message: "Expected 'by' in paginate tag" } },
  { site: 'tags/render.ts:40', tag: 'render', markup: '1', expect: { ctor: 'Error', message: 'Expected string or variable lookup for snippet, got Number' } },
  { site: 'tags/content-for.ts:12', tag: 'content_for', markup: 'x', expect: { ctor: 'Error', message: 'Expected string for content_for type, got VariableLookup' } },
  { site: 'tags/partial.ts:12', tag: 'partial', markup: 'x', expect: { ctor: 'Error', message: 'Expected string for partial name, got VariableLookup' } },
  { site: 'tags/section.ts:12', tag: 'section', markup: 'x', expect: { ctor: 'Error', message: 'Expected string for section name, got VariableLookup' } },
  { site: 'tags/sections.ts:11', tag: 'sections', markup: 'x', expect: { ctor: 'Error', message: 'Expected string for sections name, got VariableLookup' } },
  ...probeEntries(),
];

/* The string keys of `Object.prototype` in this Node, read at run time. */
function runtimePrototypeKeys(): string[] {
  return Reflect.ownKeys(Object.prototype).filter((key): key is string => typeof key === 'string');
}

/* Round 5 K2: one probe per sharing site and per `Object.prototype` key. */
function probeEntries(): ProbeEntry[] {
  const shared = 'adaptComplex stores one position on the BooleanExpression and the adapted node';
  const literal = 'isLiteralKeyword uses `in`, which finds Object.prototype keys';
  return [
    { site: 'markup/expression-adapter.ts:126 with :152', tag: 'echo', markup: 'a and b', check: { kind: 'hasAlias' }, why: shared },
    { site: 'markup/expression-adapter.ts:136 with :152', tag: 'echo', markup: 'a == b', check: { kind: 'hasAlias' }, why: shared },
    ...runtimePrototypeKeys().map((key): ProbeEntry => ({
      site: 'markup/parser.ts:337',
      tag: 'echo',
      markup: key,
      check: { kind: 'hasLiteral', key },
      why: literal,
    })),
    { site: 'markup/parser.ts:337', tag: 'echo', markup: '__proto__ | default: __proto__', check: { kind: 'hasAlias' }, why: 'both literals hold the one Object.prototype' },
    { site: 'markup/parser.ts:337', tag: 'for', markup: 'x in constructor', check: { kind: 'hasLiteral', key: 'constructor' }, why: literal },
    { site: 'markup/parser.ts:337', tag: 'if', markup: 'toString == valueOf', check: { kind: 'hasLiteral', key: 'toString' }, why: literal },
    { site: 'control, markup/parser.ts:338', tag: 'echo', markup: 'constructor.name', check: { kind: 'hasLookup', name: 'constructor' }, why: 'a literal keyword followed by a dot is a lookup' },
    { site: 'control, ID regex ? suffix', tag: 'echo', markup: 'constructor?', check: { kind: 'hasLookup', name: 'constructor?' }, why: 'the Id token includes the ?, so it is no prototype key' },
  ];
}

/* One valid markup per tag, used only for a tag with no real input. */
const VALID_MARKUP: Record<string, string> = {
  assign: 'x = 1',
  block: "'_text'",
  break: '',
  capture: 'x',
  case: 'x',
  content_for: "'blocks'",
  continue: '',
  cycle: "'a', 'b'",
  decrement: 'x',
  echo: 'x | upcase',
  for: 'x in y',
  form: "'product', p",
  if: 'a and b',
  ifchanged: '',
  include: "'x'",
  increment: 'x',
  layout: "'theme'",
  paginate: 'x by 5',
  partial: "'x'",
  render: "'x'",
  section: "'x'",
  sections: "'x'",
  tablerow: 'x in y',
  unless: 'a',
  comment: '',
  doc: '',
  javascript: '',
  raw: '',
  schema: '',
  style: '',
  stylesheet: '',
};

const STUB_PARSER: Parser = {
  parseLiquidStatement() {
    throw new Error('rust-parity stub: no document parser');
  },
};

/*
 * Rule 1: every `{% name markup %}` whose open token is followed by its close
 * token. TS `tokenize` emits the tag's inner text as one Text token between
 * the two, so at most one Text token may sit between them.
 */
function realTags(id: string, source: string): TagInput[] {
  const tokens = tokenize(source);
  const found: TagInput[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    const open = tokens[i];
    const textBetween = tokens[i + 1].type === TokenType.Text ? 1 : 0;
    const close = tokens[i + 1 + textBetween];
    if (open.type !== TokenType.LiquidTagOpen || close?.type !== TokenType.LiquidTagClose) continue;
    const inner = source.slice(open.end, close.start);
    const match = /^\s*(\S+)/.exec(inner);
    if (!match) continue;
    const tag = match[1];
    if (!Object.hasOwn(builtinTags, tag) || tag === 'liquid') continue;
    const afterName = inner.slice(match[0].length);
    const gap = /^\s*/.exec(afterName)![0].length;
    const markupStart = open.end + match[0].length + gap;
    found.push({ id, inputClass: 'real', tag, source, markupStart, markupEnd: close.start });
  }
  return found;
}

function markupOf(input: TagInput): string {
  return input.source.slice(input.markupStart, input.markupEnd);
}

/* Rule 2: the tag cut at the end of each markup token but the last real one. */
function truncations(input: TagInput): TagInput[] {
  const tokens = tokenizeMarkup(markupOf(input), input.markupStart).filter(
    (token) => token.type !== MarkupTokenType.EndOfString,
  );
  return tokens.slice(0, -1).map((token) => ({
    ...input,
    id: `${input.id}@${token.end}`,
    inputClass: 'truncation' as const,
    markupEnd: token.end,
  }));
}

function syntheticInput(site: string, tag: string, markup: string): TagInput {
  const source = `{% ${tag} ${markup} %}`;
  const [input] = realTags(`synthetic ${site}`, source);
  if (!input || input.tag !== tag) throw new Error(`synthetic ${site}: rule 1 did not find {% ${tag} %}`);
  return { ...input, inputClass: 'synthetic', site };
}

function tsOutcome(input: TagInput, tolerant: boolean): Outcome {
  const tokens = tokenizeMarkup(markupOf(input), input.markupStart);
  const markup = new MarkupParser(tokens, input.source, input.markupStart, input.markupEnd);
  if (tolerant) markup.enableTolerant();
  try {
    const value = TAGS[input.tag].parse(input.tag, markup, STUB_PARSER);
    return { threw: false, value: { markup: value, atEnd: markup.isAtEnd() } };
  } catch (error) {
    return { threw: true, value: error };
  }
}

/* Copied verbatim from src/backend.ts:105-118, which is private. */
function throwBackendError(error: BackendError, source: string): never {
  if (error.ctor === 'Error') throw new Error(error.message);
  if (error.ctor !== 'LiquidHTMLASTParsingError') {
    throw new Error(`Unknown parser backend error constructor: ${error.ctor}`);
  }

  const unclosed = hydrate(error.unclosed, source) as UnclosedNode | null;
  throw new LiquidHTMLASTParsingError(
    error.message,
    source,
    error.start,
    error.end,
    unclosed ?? undefined,
  );
}

function rustOutcome(input: TagInput, tolerant: boolean): Outcome {
  const wire = debug_parse_tag(input.source, input.tag, input.markupStart, input.markupEnd, tolerant);
  const result = JSON.parse(wire) as BackendResult;
  if (result.ok) return { threw: false, value: hydrate(result.ast, input.source) };
  try {
    throwBackendError(result.error, input.source);
  } catch (error) {
    return { threw: true, value: error };
  }
}

function describeError(value: unknown): Expect | undefined {
  if (!(value instanceof Error)) return undefined;
  return { ctor: value.constructor.name, message: value.message };
}

/* Every reachable entry must throw exactly its `expect` in TS, in both modes. */
function checkSyntheticExpectations(inputs: Map<string, { input: TagInput; expect: Expect }>): number {
  let failures = 0;
  for (const [site, { input, expect }] of inputs) {
    for (const tolerant of [false, true]) {
      const outcome = tsOutcome(input, tolerant);
      const actual = outcome.threw ? describeError(outcome.value) : undefined;
      if (actual?.ctor === expect.ctor && actual.message === expect.message) continue;
      failures++;
      console.log(
        `EXPECT FAIL ${site} tolerant=${tolerant}: expected ${JSON.stringify(expect)}, TS gave ${
          outcome.threw ? JSON.stringify(actual ?? String(outcome.value)) : 'no throw'
        }`,
      );
    }
  }
  return failures;
}

function probeHolds(check: ProbeCheck, outcome: Outcome, source: string): boolean {
  if (outcome.threw) return false;
  const nodes = nodesOf(outcome.value);
  const literals = nodes.filter((node) => node.type === 'LiquidLiteral');
  if (check.kind === 'hasAlias') return canonicalOutcome(outcome, source).includes('{"$ref":');
  if (check.kind === 'hasLiteral') return literals.some((node) => node.keyword === check.key);
  const lookup = nodes.some((node) => node.type === 'VariableLookup' && node.name === check.name);
  return lookup && literals.length === 0;
}

/* Every probe's check must hold on the TS outcome, in both modes. */
function checkProbes(probes: { input: TagInput; check: ProbeCheck }[]): number {
  let failures = 0;
  for (const { input, check } of probes) {
    for (const tolerant of [false, true]) {
      if (probeHolds(check, tsOutcome(input, tolerant), input.source)) continue;
      failures++;
      console.log(`CHECK FAIL ${input.id} tolerant=${tolerant}: ${JSON.stringify(check)} does not hold in TS`);
    }
  }
  return failures;
}

class Counter {
  private counts = new Map<string, { inputs: number; mismatches: number }>();

  add(key: string, mismatch: boolean): void {
    const entry = this.counts.get(key) ?? { inputs: 0, mismatches: 0 };
    entry.inputs++;
    if (mismatch) entry.mismatches++;
    this.counts.set(key, entry);
  }

  print(label: string, keys: string[] = [...this.counts.keys()]): void {
    for (const key of keys) {
      const entry = this.counts.get(key) ?? { inputs: 0, mismatches: 0 };
      console.log(`${label} ${key}: ${entry.inputs} runs, ${entry.mismatches} mismatches`);
    }
  }

  total(): number {
    return [...this.counts.values()].reduce((sum, entry) => sum + entry.mismatches, 0);
  }
}

function dedupe(inputs: TagInput[]): TagInput[] {
  const seen = new Set<string>();
  return inputs.filter((input) => {
    const key = `${input.tag}\u0000${markupOf(input)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function tagMode(): Promise<number> {
  const corpus = (await loadNodeCorpus(PKG)).filter((input) => input.whole);
  const wellFormed = corpus.filter((input) =>
    (input.source as string & { isWellFormed(): boolean }).isWellFormed(),
  );
  console.log(
    `Tag mode corpus: ${corpus.length} whole inputs, ${corpus.length - wellFormed.length} skipped as not well-formed`,
  );

  const real = dedupe(wellFormed.flatMap((input) => realTags(input.id, input.source)));
  const truncated = real.flatMap(truncations);

  const expected = new Map<string, { input: TagInput; expect: Expect }>();
  const unreachable: { site: string; reason: string }[] = [];
  const probes: { input: TagInput; check: ProbeCheck }[] = [];
  for (const entry of SYNTHETIC) {
    if ('unreachable' in entry) {
      unreachable.push({ site: entry.site, reason: entry.unreachable });
      continue;
    }
    const input = syntheticInput(entry.site, entry.tag, entry.markup);
    if ('check' in entry) {
      probes.push({ input: { ...input, id: `probe ${entry.site} {% ${entry.tag} ${entry.markup} %}` }, check: entry.check });
      continue;
    }
    expected.set(entry.site, { input, expect: entry.expect });
  }
  const realTagNames = new Set(real.map((input) => input.tag));
  const validSynthetic = TAG_NAMES.filter((tag) => !realTagNames.has(tag)).map((tag) =>
    syntheticInput(`valid ${tag}`, tag, VALID_MARKUP[tag]),
  );
  let expectFailures = checkSyntheticExpectations(expected) + checkProbes(probes);
  for (const input of validSynthetic) {
    const outcome = tsOutcome(input, false);
    if (!outcome.threw) continue;
    expectFailures++;
    console.log(`EXPECT FAIL ${input.site}: TS threw ${String(outcome.value)}`);
  }

  const inputs = [
    ...real,
    ...truncated,
    ...[...expected.values()].map((e) => e.input),
    ...probes.map((p) => p.input),
    ...validSynthetic,
  ];
  const perTag = new Counter();
  const perMode = new Counter();
  const perClass = new Counter();
  const perSite = new Counter();
  for (const input of inputs) {
    for (const tolerant of [false, true]) {
      const ts = tsOutcome(input, tolerant);
      const rust = rustOutcome(input, tolerant);
      const mismatch = canonicalOutcome(ts, input.source) !== canonicalOutcome(rust, input.source);
      perTag.add(input.tag, mismatch);
      perMode.add(`tolerant=${tolerant}`, mismatch);
      perClass.add(input.inputClass, mismatch);
      if (input.site) perSite.add(input.site, mismatch);
      if (!mismatch) continue;
      console.log(
        `MISMATCH ${input.id} tag=${input.tag} tolerant=${tolerant} markup=${JSON.stringify(markupOf(input))}: ${firstDivergentPath(ts, rust)}`,
      );
    }
  }

  perTag.print('tag', TAG_NAMES);
  perMode.print('mode');
  perClass.print('class', ['real', 'truncation', 'synthetic']);
  perSite.print('site');
  for (const { site, reason } of unreachable) console.log(`site ${site}: unreachable: ${reason}`);
  const runtimeKeyProbes = probes.filter(
    ({ input, check }) => check.kind === 'hasLiteral' && input.tag === 'echo' && markupOf(input).trim() === check.key,
  ).length;
  console.log(
    `Runtime-key probes: ${runtimeKeyProbes}, string keys of Reflect.ownKeys(Object.prototype): ${runtimePrototypeKeys().length}`,
  );
  const missing = TAG_NAMES.filter((tag) => !inputs.some((input) => input.tag === tag));
  console.log(`Tags with no input: ${missing.length === 0 ? 'none' : missing.join(', ')}`);
  console.log(`Synthetic expectation failures: ${expectFailures}`);
  const mismatches = perTag.total();
  console.log(`Total mismatches: ${mismatches}`);
  const keysCovered = runtimeKeyProbes === runtimePrototypeKeys().length;
  return mismatches === 0 && expectFailures === 0 && missing.length === 0 && keysCovered ? 0 : 1;
}

interface DocInput {
  id: string;
  inputClass: 'doc' | 'whole';
  source: string;
  bodyStart: number;
  bodyEnd: number;
}

/* The doc throw sites, each with the reason TS cannot reach it. */
const DOC_SYNTHETIC: Extract<SyntheticEntry, { unreachable: string }>[] = [
  {
    site: 'liquid-doc/parser.ts:394',
    unreachable: "consume's only caller, parser.ts:119, runs only after check(Annotation) at :80",
  },
];

/* Every `{% name %}` envelope, found as rule 1 finds a tag, with its name. */
function tagEnvelopes(source: string): { name: string; start: number; closeEnd: number }[] {
  const tokens = tokenize(source);
  const found: { name: string; start: number; closeEnd: number }[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    const open = tokens[i];
    const textBetween = tokens[i + 1].type === TokenType.Text ? 1 : 0;
    const close = tokens[i + 1 + textBetween];
    if (open.type !== TokenType.LiquidTagOpen || close?.type !== TokenType.LiquidTagClose) continue;
    const match = /^\s*(\S+)/.exec(source.slice(open.end, close.start));
    if (!match) continue;
    found.push({ name: match[1], start: open.start, closeEnd: close.end });
  }
  return found;
}

/* Every body between a `doc` tag's close and the next `enddoc` tag's open. */
function docBodies(id: string, source: string): DocInput[] {
  const envelopes = tagEnvelopes(source);
  return envelopes.flatMap((doc) => {
    if (doc.name !== 'doc') return [];
    const end = envelopes.find((e) => e.name === 'enddoc' && e.start >= doc.closeEnd);
    if (!end) return [];
    return [{ id: `${id}@${doc.closeEnd}`, inputClass: 'doc' as const, source, bodyStart: doc.closeEnd, bodyEnd: end.start }];
  });
}

function docTsOutcome(input: DocInput): Outcome {
  try {
    const body = input.source.slice(input.bodyStart, input.bodyEnd);
    return { threw: false, value: parseLiquidDoc(body, input.bodyStart, input.source) };
  } catch (error) {
    return { threw: true, value: error };
  }
}

function docRustOutcome(input: DocInput): Outcome {
  const wire = debug_parse_liquid_doc(input.source, input.bodyStart, input.bodyEnd);
  const result = JSON.parse(wire) as BackendResult;
  if (result.ok) return { threw: false, value: hydrate(result.ast, input.source) };
  try {
    throwBackendError(result.error, input.source);
  } catch (error) {
    return { threw: true, value: error };
  }
}

async function docMode(): Promise<number> {
  const corpus = (await loadNodeCorpus(PKG)).filter((input) => input.whole);
  const wellFormed = corpus.filter((input) =>
    (input.source as string & { isWellFormed(): boolean }).isWellFormed(),
  );
  const bodies = wellFormed.flatMap((input) => docBodies(input.id, input.source));
  const wholes = wellFormed.map(
    (input): DocInput => ({ id: input.id, inputClass: 'whole', source: input.source, bodyStart: 0, bodyEnd: input.source.length }),
  );
  console.log(
    `Doc mode corpus: ${corpus.length} whole inputs, ${corpus.length - wellFormed.length} skipped as not well-formed`,
  );
  console.log(`Doc inputs: ${bodies.length} doc bodies, ${wholes.length} whole inputs`);

  const perClass = new Counter();
  for (const input of [...bodies, ...wholes]) {
    const ts = docTsOutcome(input);
    const rust = docRustOutcome(input);
    const mismatch = canonicalOutcome(ts, input.source) !== canonicalOutcome(rust, input.source);
    perClass.add(input.inputClass, mismatch);
    if (!mismatch) continue;
    console.log(`MISMATCH doc ${input.id} body=${input.bodyStart}..${input.bodyEnd}: ${firstDivergentPath(ts, rust)}`);
  }

  perClass.print('class', ['doc', 'whole']);
  for (const { site, unreachable } of DOC_SYNTHETIC) console.log(`site ${site}: unreachable: ${unreachable}`);
  const mismatches = perClass.total();
  console.log(`Doc total mismatches: ${mismatches}`);
  return mismatches === 0 ? 0 : 1;
}

function parseMode(argv: string[]): string[] {
  const at = argv.indexOf('--mode');
  if (at === -1) return ['tags', 'doc'];
  const mode = argv[at + 1];
  if (mode !== 'tags' && mode !== 'doc') throw new Error(`Unknown --mode ${mode}; use tags or doc`);
  return [mode];
}

async function main(): Promise<number> {
  initSync({ module: Buffer.from(wasmBase64, 'base64') });
  let code = 0;
  for (const mode of parseMode(process.argv.slice(2))) {
    if (mode === 'tags') code = Math.max(code, await tagMode());
    if (mode === 'doc') code = Math.max(code, await docMode());
  }
  return code;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
