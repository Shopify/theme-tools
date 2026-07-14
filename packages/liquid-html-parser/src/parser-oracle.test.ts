import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toLiquidHtmlAST, toLiquidAST } from './ast';
import { nonTraversableProperties } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures', 'theme');
const GOLDEN_HTML_AST_DIR = resolve(__dirname, '..', 'fixtures', 'golden-html-ast');
const GOLDEN_LIQUID_AST_DIR = resolve(__dirname, '..', 'fixtures', 'golden-liquid-ast');

const THEMES = ['base-theme', 'dawn', 'horizon'];

function stripAST(ast: any): any {
  return JSON.parse(
    JSON.stringify(ast, (key, value) => {
      if (key === 'source' || key === '_source') return undefined;
      if (nonTraversableProperties.has(key)) return undefined;
      if (
        key === 'locStart' ||
        key === 'locEnd' ||
        key === 'conditions' ||
        key === 'renderArguments' ||
        key === 'sectionName' ||
        key === 'blockName' ||
        key === 'blockStartLocStart' ||
        key === 'blockStartLocEnd' ||
        key === 'blockEndLocStart' ||
        key === 'blockEndLocEnd' ||
        key === 'attrList'
      )
        return undefined;
      return value;
    }),
  );
}

/** Recursively find all .liquid files under a directory */
function findLiquidFiles(dir: string, prefix = ''): { path: string; fullPath: string }[] {
  const results: { path: string; fullPath: string }[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...findLiquidFiles(join(dir, entry.name), relPath));
    } else if (entry.name.endsWith('.liquid')) {
      results.push({ path: relPath, fullPath: join(dir, entry.name) });
    }
  }
  return results;
}

function goldenFileName(relativePath: string): string {
  return relativePath.replace(/\//g, '-') + '.json';
}

const hasFixtures = existsSync(FIXTURES_DIR) && readdirSync(FIXTURES_DIR).length > 0;

describe.skipIf(!hasFixtures)('Parser Oracle', () => {
  for (const theme of THEMES) {
    const themeDir = join(FIXTURES_DIR, theme);
    const files = findLiquidFiles(themeDir);

    describe(`toLiquidHtmlAST - ${theme}`, () => {
      for (const { path, fullPath } of files) {
        const goldenPath = join(GOLDEN_HTML_AST_DIR, theme, goldenFileName(path));
        // Only test if golden file exists (some files may not parse)
        if (!existsSync(goldenPath)) continue;

        it(`produces identical AST for ${theme}/${path}`, () => {
          const source = readFileSync(fullPath, 'utf-8');
          const ast = toLiquidHtmlAST(source);
          const stripped = stripAST(ast);
          const golden = JSON.parse(readFileSync(goldenPath, 'utf-8'));
          expect(stripped).toEqual(golden);
        });
      }
    });

    describe(`toLiquidAST - ${theme}`, () => {
      for (const { path, fullPath } of files) {
        const goldenPath = join(GOLDEN_LIQUID_AST_DIR, theme, goldenFileName(path));
        // Only test if golden file exists (some files may not parse in liquid-only mode)
        if (!existsSync(goldenPath)) continue;

        it(`produces identical AST for ${theme}/${path}`, () => {
          const source = readFileSync(fullPath, 'utf-8');
          const ast = toLiquidAST(source);
          const stripped = stripAST(ast);
          const golden = JSON.parse(readFileSync(goldenPath, 'utf-8'));
          expect(stripped).toEqual(golden);
        });
      }
    });
  }
});
