import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Document, isScalar, parse, visit } from 'yaml';
import { toLiquidAST, toLiquidHtmlAST } from './ast';
import { LiquidHTMLASTParsingError } from './errors';
import { nonTraversableProperties } from './types';

/**
 * Runs the language-neutral parser specs in specs/parser at the repo root.
 * The format is described in specs/parser/README.md.
 *
 * With UPDATE_SPECS=1, it writes each case's ast or error from this parser instead.
 */

type Parse = 'html' | 'liquid';
type Start = [line: number, character: number];

interface SpecPosition {
  start: Start;
  text: string;
}

interface SpecError extends SpecPosition {
  message: string;
}

interface Case {
  name: string;
  source: string;
  parse: Parse[];
  ast?: unknown;
  error?: SpecError;
}

const specsDir = resolve(__dirname, '../../../specs/parser');
const caseKeys = ['name', 'source', 'parse', 'ast', 'error'];
const parsers = { html: toLiquidHtmlAST, liquid: toLiquidAST };
const update = !!process.env.UPDATE_SPECS;

for (const specFile of readdirSync(specsDir).filter((f) => f.endsWith('.yml'))) {
  const specPath = resolve(specsDir, specFile);
  const spec: { cases: Case[] } = parse(readFileSync(specPath, 'utf8'));

  describe(`specs/parser/${specFile}`, () => {
    for (const c of spec.cases) {
      it(c.name, () => {
        // A misspelled key would silently check nothing.
        for (const key of Object.keys(c)) expect(caseKeys, 'case keys').toContain(key);
        expect(c.parse.length, 'parse').toBeGreaterThan(0);
        for (const p of c.parse) expect(Object.keys(parsers), 'parse').toContain(p);
        const results = c.parse.map((p) => run(p, c.source));
        if (update) {
          for (const result of results)
            expect(result, 'html and liquid differ').toEqual(results[0]);
          delete c.ast;
          delete c.error;
          Object.assign(c, results[0]);
        } else {
          expect('ast' in c !== 'error' in c, 'one of ast and error').toBe(true);
          c.parse.forEach((p, i) => expect(results[i], p).toEqual({ ast: c.ast, error: c.error }));
        }
      });
    }

    if (update) afterAll(() => writeFileSync(specPath, toYaml(spec)));
  });
}

function run(p: Parse, source: string): Pick<Case, 'ast' | 'error'> {
  try {
    return { ast: toSpecTree(source, parsers[p](source)) };
  } catch (e) {
    if (!(e instanceof LiquidHTMLASTParsingError)) throw e;
    return { error: toSpecError(source, e) };
  }
}

/**
 * The tree without the source and the links between nodes, and with positions as text. A node's
 * nested nodes come after its other properties.
 */
function toSpecTree(source: string, tree: unknown): unknown {
  const leaf = (value: unknown) => value === null || typeof value !== 'object' || isRange(value);
  return JSON.parse(
    JSON.stringify(tree, (key, value) => {
      if (key === 'source' || key === '_source') {
        // It's the template on every node, so the spec leaves it out.
        expect(value, key).toBe(source);
        return;
      }
      if (nonTraversableProperties.has(key)) return;
      if (isRange(value)) return toSpecPosition(source, value.start, value.end);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      return Object.fromEntries(
        Object.entries(value).sort(([, a], [, b]) => +!leaf(a) - +!leaf(b)),
      );
    }),
  );
}

function isRange(value: any): value is { start: number; end: number } {
  return (
    typeof value?.start === 'number' &&
    typeof value?.end === 'number' &&
    Object.keys(value).length === 2
  );
}

// Cut out at the range, so with start the text pins it even when it repeats.
function toSpecPosition(source: string, start: number, end: number): SpecPosition {
  expect(0 <= start && start <= end && end <= source.length, 'range in source').toBe(true);
  const before = source.slice(0, start);
  const line = before.split('\n').length - 1;
  return {
    start: [line, start - (before.lastIndexOf('\n') + 1)],
    text: source.slice(start, end),
  };
}

function toSpecError(source: string, e: LiquidHTMLASTParsingError): SpecError {
  // loc is 1-based. Its columns, like JS string indices, are in UTF-16 code units.
  // The parser never sets it, so a spec error has no unclosed node.
  expect(e.unclosed, 'unclosed').toBeNull();
  const lines = source.split('\n');
  const offset = ({ line, column }: { line: number; column: number }) =>
    lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + column - 1;
  return {
    message: e.message,
    ...toSpecPosition(source, offset(e.loc!.start), offset(e.loc!.end)),
  };
}

/** Positions and lists of scalars on one line, unless the text has several, spaced as prettier does. */
function toYaml(spec: unknown) {
  const doc = new Document(spec);
  visit(doc, {
    Map(_, map) {
      const text = map.get('text');
      if (map.items.length === 2 && map.has('start') && !String(text).includes('\n')) {
        map.flow = true;
      }
    },
    Seq(_, seq) {
      if (seq.items.every(isScalar)) seq.flow = true;
    },
  });
  return doc
    .toString({ lineWidth: 0, flowCollectionPadding: false })
    .replace(/\{(start: .*)\}$/gm, '{ $1 }');
}
