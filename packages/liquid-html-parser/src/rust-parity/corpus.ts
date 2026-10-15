/*
 * The parity corpus: every input the TS and Rust parsers are compared on.
 *
 * 1. Every `.liquid` file of the pinned fixture themes (fixtures/theme/).
 * 2. Every `index.liquid` and `fixed.liquid` of the prettier plugin tests.
 * 3. Every source in fixtures/error-corpus.ts, plus, as part 3b, the stray
 *    `endsection` sources in ./error-corpus-extra.ts.
 * 4. Prefix cuts of parts 1 and 2: each file truncated at PREFIX_CUTS evenly
 *    spaced code-point boundaries, standing in for half-typed documents.
 *
 * Fixture modules live outside `src/`, so they are imported through computed
 * specifiers. That keeps `tsc` from pulling them into the build.
 */

import { ERROR_FILES_EXTRA } from './error-corpus-extra';

export const PREFIX_CUTS = 20;

export type CorpusPart = 'theme' | 'prettier' | 'error-corpus';

export interface CorpusInput {
  id: string;
  part: CorpusPart;
  /** `false` for a prefix cut */
  whole: boolean;
  source: string;
}

export interface CorpusSources {
  themes: { path: string; source: string }[];
  prettier: { path: string; source: string }[];
  errors: { path: string; source: string }[];
}

export interface CorpusCounts {
  themeFiles: number;
  prettierFiles: number;
  errorCorpusFiles: number;
  prefixCutsPerFile: number;
  prefixCuts: number;
  total: number;
}

export function buildCorpus(sources: CorpusSources): CorpusInput[] {
  const themes = sources.themes.map((file) =>
    wholeInput(`theme/${file.path}`, 'theme', file.source),
  );
  const prettier = sources.prettier.map((file) =>
    wholeInput(`prettier/${file.path}`, 'prettier', file.source),
  );
  const errors = sources.errors.map((file) => wholeInput(file.path, 'error-corpus', file.source));
  const cuts = [...themes, ...prettier].flatMap(prefixCuts);
  return [...themes, ...prettier, ...errors, ...cuts];
}

export function countCorpus(corpus: CorpusInput[]): CorpusCounts {
  const countWhole = (part: CorpusPart) =>
    corpus.filter((input) => input.whole && input.part === part).length;
  const prefixCutCount = corpus.filter((input) => !input.whole).length;
  return {
    themeFiles: countWhole('theme'),
    prettierFiles: countWhole('prettier'),
    errorCorpusFiles: countWhole('error-corpus'),
    prefixCutsPerFile: PREFIX_CUTS,
    prefixCuts: prefixCutCount,
    total: corpus.length,
  };
}

/*
 * Cut k of n sits at floor(k * length / (n + 1)) code points, for k = 1..n.
 * Cutting by code point never splits a surrogate pair.
 */
export function prefixCuts(input: CorpusInput): CorpusInput[] {
  const codePoints = Array.from(input.source);
  const cuts: CorpusInput[] = [];
  for (let k = 1; k <= PREFIX_CUTS; k++) {
    const at = Math.floor((k * codePoints.length) / (PREFIX_CUTS + 1));
    cuts.push({
      id: `${input.id}#cut${k}of${PREFIX_CUTS}`,
      part: input.part,
      whole: false,
      source: codePoints.slice(0, at).join(''),
    });
  }
  return cuts;
}

/** Node variant: reads themes listed in fixtures/theme/manifest.json and prettier fixtures from disk. */
export async function loadNodeCorpus(packageRoot: string): Promise<CorpusInput[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const themeDir = path.join(packageRoot, 'fixtures', 'theme');
  const manifest: { theme: string }[] = JSON.parse(
    fs.readFileSync(path.join(themeDir, 'manifest.json'), 'utf8'),
  );
  const themes = manifest.flatMap(({ theme }) =>
    readLiquidFiles(fs, path, path.join(themeDir, theme), theme, () => true),
  );
  const prettierDir = path.join(packageRoot, '..', 'prettier-plugin-liquid', 'src', 'test');
  const prettier = readLiquidFiles(fs, path, prettierDir, '', isPrettierFixture);
  const errors = await importErrorCorpus(path.join(packageRoot, 'fixtures', 'error-corpus.ts'));
  return buildCorpus({
    themes: sortByPath(themes),
    prettier: sortByPath(prettier),
    errors: [...errors, ...ERROR_FILES_EXTRA],
  });
}

/** Browser variant: no fs, so themes come from fixtures/theme-bundle.ts. */
export async function loadBrowserCorpus(
  prettier: { path: string; source: string }[] = [],
): Promise<CorpusInput[]> {
  const bundleSpecifier = '../../fixtures/theme-bundle.ts';
  const errorSpecifier = '../../fixtures/error-corpus.ts';
  const bundle = await import(/* @vite-ignore */ bundleSpecifier);
  const errors = await import(/* @vite-ignore */ errorSpecifier);
  return buildCorpus({
    themes: bundle.THEME_FILES,
    prettier: sortByPath(prettier),
    errors: [...errors.ERROR_FILES, ...ERROR_FILES_EXTRA],
  });
}

function wholeInput(id: string, part: CorpusPart, source: string): CorpusInput {
  return { id, part, whole: true, source };
}

function isPrettierFixture(name: string): boolean {
  return name === 'index.liquid' || name === 'fixed.liquid';
}

function sortByPath<T extends { path: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

async function importErrorCorpus(file: string): Promise<{ path: string; source: string }[]> {
  const specifier = file;
  const mod = await import(/* @vite-ignore */ specifier);
  return mod.ERROR_FILES;
}

function readLiquidFiles(
  fs: typeof import('node:fs'),
  path: typeof import('node:path'),
  dir: string,
  prefix: string,
  include: (name: string) => boolean,
): { path: string; source: string }[] {
  const results: { path: string; source: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readLiquidFiles(fs, path, full, relPath, include));
      continue;
    }
    if (entry.name.endsWith('.liquid') && include(entry.name)) {
      results.push({ path: relPath, source: fs.readFileSync(full, 'utf8') });
    }
  }
  return results;
}
