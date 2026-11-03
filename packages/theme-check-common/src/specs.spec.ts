import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  allChecks,
  CheckDefinition,
  ChecksSettings,
  Mode,
  Modes,
  Offense,
  Reference,
  Severity,
  ThemeDocset,
} from './index';
import * as path from './path';
import { applyFix, applySuggestions, autofix, check } from './test';
import { MockTheme } from './test/MockTheme';

/**
 * Runs the language-neutral check specs in specs/checks at the repo root.
 * The format is described in specs/checks/README.md.
 */

/** Without `check`, a spec tests a feature, and each case lists its `checks`. */
interface Spec {
  check?: string;
  severity?: 'error' | 'warning' | 'info';
  cases: Case[];
}

interface Case {
  name: string;
  checks?: string[];
  files: Record<string, Text>;
  docset?: string | Docset;
  config?: ChecksSettings;
  mode?: Mode;
  references?: { source: string; target: string; type?: Reference['type'] }[];
  offenses?: SpecOffense[];
  autofix?: Record<string, string>;
}

interface SpecOffense {
  check?: string;
  file: string;
  message: string;
  start: [line: number, character: number];
  highlight: Text;
  fix?: string;
  suggest?: { message: string; result: string }[];
}

interface Docset {
  filters?: any[];
  objects?: any[];
  tags?: any[];
  systemTranslations?: any;
}

/** A file's content: a string, or parts to join, for files too large to write out. */
type Text = string | (string | { repeat: string; times: number })[];

const specsDir = resolve(__dirname, '../../../specs/checks');
const rootUri = path.normalize('file:/');
const specced = new Set<string>();

for (const specFile of readdirSync(specsDir).filter((f) => f.endsWith('.yml'))) {
  const spec: Spec = parse(readFileSync(resolve(specsDir, specFile), 'utf8'));
  const checkDefs = allChecks.filter((def) => def.meta.code === spec.check);
  if (spec.check) specced.add(spec.check);

  describe(`specs/${specFile}`, () => {
    if (spec.check) {
      it(`has ${spec.check}'s severity`, () => {
        expect(checkDefs).not.toHaveLength(0);
        for (const def of checkDefs) {
          expect(Severity[def.meta.severity].toLowerCase()).toBe(spec.severity);
        }
      });
    }

    for (const c of spec.cases) {
      it(c.name, async () => {
        // A file at a URL is a remote file: the check only ever sees its size.
        const isRemote = (file: string) => /^https?:\/\//.test(file);
        const entries = Object.entries(c.files).map(([file, text]) => [file, expand(text)]);
        const files = Object.fromEntries(entries.filter(([file]) => !isRemote(file)));
        const remoteSizes = new Map(
          entries
            .filter(([file]) => isRemote(file))
            .map(([url, text]) => [url, Buffer.byteLength(text)]),
        );
        const defs = c.checks
          ? allChecks.filter((def) => c.checks!.includes(def.meta.code))
          : checkDefs;
        expect(defs, 'checks to run').not.toHaveLength(0);
        for (const code of c.checks ?? []) {
          expect(
            defs.map((def) => def.meta.code),
            'checks',
          ).toContain(code);
        }
        // An option the check doesn't have would be silently ignored.
        for (const [code, options] of Object.entries(c.config ?? {})) {
          const def = defs.find((def) => def.meta.code === code);
          for (const key of Object.keys(options ?? {})) {
            expect(Object.keys(def?.meta.schema ?? {}), `${code} options`).toContain(key);
          }
        }
        // Which files render which, as production gets it from the theme graph.
        const references: Reference[] = (c.references ?? []).map(({ source, target, type }) => {
          expect(Object.keys(files), 'reference ends').toContain(source);
          expect(Object.keys(files), 'reference ends').toContain(target);
          expect(['direct', 'indirect', 'preset'], 'reference type').toContain(type ?? 'direct');
          return {
            source: { uri: path.join(rootUri, source) },
            target: { uri: path.join(rootUri, target) },
            type: type ?? 'direct',
          };
        });
        const deps = {
          themeDocset: toDocset(c.docset),
          getReferences: async (uri: string) => references.filter((r) => r.target.uri === uri),
          getDependencies: async (uri: string) => references.filter((r) => r.source.uri === uri),
          remoteFileSize: async (url: string) => remoteSizes.get(url) ?? 0,
        };
        expect(Modes).toContain(c.mode ?? 'theme');
        const offenses = await check(files, defs, deps, c.config, c.mode);
        const expected = c.offenses ?? [];
        const actual = offenses.map((offense) => toSpecOffense(offense, files, defs, !!c.checks));
        // A highlight written as parts is compared as written, so a failure doesn't print it whole.
        for (const offense of actual) {
          const parts = expected.find(
            (e) => typeof e.highlight !== 'string' && expand(e.highlight) === offense.highlight,
          );
          if (parts) offense.highlight = parts.highlight;
          else if (offense.highlight.length > 1000) {
            offense.highlight = `${offense.highlight.slice(0, 100)}… (${offense.highlight.length} characters)`;
          }
        }
        expect(actual.sort(byPosition)).toEqual(expected.sort(byPosition));
        // All the fixes, applied at once. The case states each file with several.
        const fixedFiles = actual.filter((o) => o.fix !== undefined).map((o) => o.file);
        const multiFix = [
          ...new Set(fixedFiles.filter((file, i) => fixedFiles.indexOf(file) !== i)),
        ];
        const fixed = fixedFiles.length ? await autofix(files, offenses) : {};
        expect(Object.fromEntries(multiFix.map((file) => [file, fixed[file]])), 'autofix').toEqual(
          c.autofix ?? {},
        );
      });
    }
  });
}

it('has a spec for every check', () => {
  expect(allChecks.map((def) => def.meta.code).filter((code) => !specced.has(code))).toEqual([]);
});

function expand(text: Text): string {
  if (typeof text === 'string') return text;
  return text
    .map((part) => {
      if (typeof part === 'string') return part;
      if (typeof part.repeat !== 'string' || !Number.isInteger(part.times)) {
        throw new Error(`A part is a string or { repeat, times }: ${JSON.stringify(part)}`);
      }
      return part.repeat.repeat(part.times);
    })
    .join('');
}

function toDocset(docset: Case['docset']): ThemeDocset | undefined {
  if (!docset) return undefined;
  const data: Docset =
    typeof docset === 'string'
      ? parse(readFileSync(resolve(specsDir, 'docsets', `${docset}.yml`), 'utf8'))
      : docset;
  return {
    filters: async () => data.filters ?? [],
    objects: async () => data.objects ?? [],
    liquidDrops: async () => data.objects ?? [],
    tags: async () => data.tags ?? [],
    systemTranslations: async () => data.systemTranslations ?? {},
  };
}

function toSpecOffense(
  offense: Offense,
  files: MockTheme,
  defs: CheckDefinition[],
  withCheck: boolean,
): SpecOffense {
  const file = path.relative(offense.uri, rootUri);
  const text = source(files, offense.uri);
  // What a case doesn't state must be right too: the check's severity, and the positions.
  const def = defs.find((def) => def.meta.code === offense.check);
  expect(def, `offense of ${offense.check}`).toBeDefined();
  expect(offense.severity, 'offense severity').toBe(def!.meta.severity);
  for (const [name, { index, line, character }] of Object.entries({
    start: offense.start,
    end: offense.end,
  })) {
    expect(index, `offense ${name}`).toBeLessThanOrEqual(text.length);
    expect([line, character], `offense ${name} line and character`).toEqual(position(text, index));
  }
  expect(offense.end.index, 'offense end').toBeGreaterThanOrEqual(offense.start.index);
  const result: SpecOffense = {
    ...(withCheck && { check: offense.check }),
    file,
    message: offense.message,
    start: [offense.start.line, offense.start.character],
    highlight: text.slice(offense.start.index, offense.end.index),
  };
  if (offense.fix) result.fix = applyFix(files, offense);
  if (offense.suggest) {
    const results = applySuggestions(files, offense)!;
    result.suggest = offense.suggest.map(({ message }, i) => ({ message, result: results[i] }));
  }
  return result;
}

/** The [line, character] of an index, both in UTF-16 code units. */
function position(source: string, index: number): [line: number, character: number] {
  const before = source.slice(0, index);
  return [before.split('\n').length - 1, index - (before.lastIndexOf('\n') + 1)];
}

/** A file's source by URI: a case may spell a path another way, like `snippets\card.liquid`. */
function source(files: MockTheme, uri: string): string {
  const entry = Object.entries(files).find(([file]) => path.join(rootUri, file) === uri);
  if (!entry) throw new Error(`An offense in a file that isn't in the case: ${uri}`);
  return entry[1];
}

function byPosition(a: SpecOffense, b: SpecOffense) {
  return (
    a.file.localeCompare(b.file) ||
    a.start[0] - b.start[0] ||
    a.start[1] - b.start[1] ||
    a.message.localeCompare(b.message) ||
    (a.check ?? '').localeCompare(b.check ?? '') ||
    JSON.stringify(a.highlight).localeCompare(JSON.stringify(b.highlight))
  );
}
