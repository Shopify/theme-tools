import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isLiquidHtmlNode, toLiquidAST, toLiquidHtmlAST, walk } from './ast';
import type { DocumentNode, LiquidErrorNode, LiquidHtmlNode } from './ast';
import { LiquidHTMLASTParsingError } from './errors';
import { findErrorNodeAtOffset, toResilientLiquidAST, toResilientLiquidHtmlAST } from './resilient';
import { NodeTypes } from './types';

/*
 * Drop the `source`/`_source` strings before comparing two ASTs. Both parses
 * receive the identical source argument, so those fields are equal by
 * construction; stripping them keeps the structural comparison fast and loses
 * nothing. Mirrors the strip step in parser-oracle.test.ts.
 */
function structural(ast: unknown): unknown {
  return JSON.parse(
    JSON.stringify(ast, (key, value) =>
      key === 'source' || key === '_source' ? undefined : value,
    ),
  );
}

function errorNodesOf(ast: DocumentNode): LiquidErrorNode[] {
  const found: LiquidErrorNode[] = [];
  walk(ast, (node) => {
    if (node.type === NodeTypes.LiquidErrorNode) {
      found.push(node as LiquidErrorNode);
    }
  });
  return found;
}

/*
 * Default-path neutrality proof (Gate-S1 / golden-neutrality gate).
 *
 * Resilient mode is a different class reached by a different function; on
 * well-formed input its overridden `parseNode` never catches, so it must be
 * byte-identical to the strict default path. These are the two proofs of that:
 * a curated set of clean sources, and the whole on-disk clean fixture corpus.
 */
describe('resilient mode is inert on clean input', () => {
  const cleanSources = [
    '',
    'plain text only',
    '{{ product.title }}',
    '{% assign x = 1 %}',
    '{% if x %}a{% else %}b{% endif %}',
    '{% for item in collection %}{{ item.title }}{% endfor %}',
    '<div class="a" id="b">{{ x }}</div>',
    '<a href="{{ url }}">{% render \'snippet\' %}</a>',
    '{% liquid\n  assign y = 2\n  echo y\n%}',
    '{% comment %}hi{% endcomment %}',
    'text {{ a }} more {% if b %}<span>{{ c }}</span>{% endif %} end',
  ];

  for (const source of cleanSources) {
    it(`toResilientLiquidHtmlAST deep-equals toLiquidHtmlAST for ${JSON.stringify(source)}`, () => {
      expect(structural(toResilientLiquidHtmlAST(source))).toEqual(
        structural(toLiquidHtmlAST(source)),
      );
    });

    it(`toResilientLiquidAST deep-equals toLiquidAST for ${JSON.stringify(source)}`, () => {
      expect(structural(toResilientLiquidAST(source))).toEqual(structural(toLiquidAST(source)));
    });
  }
});

const FIXTURES_DIR = resolve(__dirname, '..', 'fixtures', 'theme');
const GOLDEN_HTML_AST_DIR = resolve(__dirname, '..', 'fixtures', 'golden-html-ast');
const GOLDEN_LIQUID_AST_DIR = resolve(__dirname, '..', 'fixtures', 'golden-liquid-ast');
const THEMES = ['base-theme', 'dawn', 'horizon'];

/** Recursively find all .liquid files under a directory. */
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

/*
 * The clean corpus is exactly the files the oracle has a golden for: a golden
 * exists only for a file the strict parser accepts, so those files are the
 * proven-clean set. Resilient must reproduce the strict AST for each.
 */
describe.skipIf(!hasFixtures)('resilient mode is inert over the clean fixture corpus', () => {
  for (const theme of THEMES) {
    const themeDir = join(FIXTURES_DIR, theme);
    const files = findLiquidFiles(themeDir);
    const themeMissing = files.length === 0;

    describe.skipIf(themeMissing)(`toResilientLiquidHtmlAST === toLiquidHtmlAST - ${theme}`, () => {
      for (const { path, fullPath } of files) {
        const goldenPath = join(GOLDEN_HTML_AST_DIR, theme, goldenFileName(path));
        if (!existsSync(goldenPath)) continue;

        it(`matches strict for ${theme}/${path}`, () => {
          const source = readFileSync(fullPath, 'utf-8');
          expect(structural(toResilientLiquidHtmlAST(source))).toEqual(
            structural(toLiquidHtmlAST(source)),
          );
        });
      }
    });

    describe.skipIf(themeMissing)(`toResilientLiquidAST === toLiquidAST - ${theme}`, () => {
      for (const { path, fullPath } of files) {
        const goldenPath = join(GOLDEN_LIQUID_AST_DIR, theme, goldenFileName(path));
        if (!existsSync(goldenPath)) continue;

        it(`matches strict for ${theme}/${path}`, () => {
          const source = readFileSync(fullPath, 'utf-8');
          expect(structural(toResilientLiquidAST(source))).toEqual(structural(toLiquidAST(source)));
        });
      }
    });
  }
});

/*
 * Positive-path resilient behavior. These consolidate the throwaway probes
 * from B2 (error nodes emitted), B3 (panic-mode resync) and B5 (locator) into
 * committed tests.
 */
describe('resilient mode surfaces parse errors as nodes', () => {
  it('strict parse throws on a close tag with no matching open', () => {
    expect(() => toLiquidHtmlAST('{% endfor %}')).toThrow(LiquidHTMLASTParsingError);
  });

  it('toResilientLiquidHtmlAST emits a LiquidErrorNode instead of throwing', () => {
    const source = '{% endfor %}';
    const ast = toResilientLiquidHtmlAST(source);

    expect(ast.type).toBe(NodeTypes.Document);
    expect(ast.children).toHaveLength(1);

    const node = ast.children[0] as LiquidErrorNode;
    expect(node.type).toBe(NodeTypes.LiquidErrorNode);
    expect(node.position).toEqual({ start: 0, end: 12 });
    expect(node.found).toBe('EndOfInput');
    expect(typeof node.message).toBe('string');
    expect(source.slice(node.position.start, node.position.end)).toBe('{% endfor %}');
  });

  it('toResilientLiquidAST also recovers instead of throwing', () => {
    const ast = toResilientLiquidAST('{% endfor %}');

    expect(ast.type).toBe(NodeTypes.Document);
    expect(errorNodesOf(ast)).toHaveLength(1);
  });
});

describe('resilient mode resynchronizes after an error (panic mode)', () => {
  it('recovers valid nodes between multiple errors and terminates', () => {
    const ast = toResilientLiquidHtmlAST('{% endfor %}{{ good }}{% endif %}');

    expect(ast.children.map((child) => child.type)).toEqual([
      NodeTypes.LiquidErrorNode,
      NodeTypes.LiquidVariableOutput,
      NodeTypes.LiquidErrorNode,
    ]);

    const errors = errorNodesOf(ast);
    expect(errors.length).toBeGreaterThanOrEqual(2);

    // The construct between the two errors is recovered as a real node.
    const recovered = ast.children[1];
    expect(recovered.type).toBe(NodeTypes.LiquidVariableOutput);
    expect(recovered.position).toEqual({ start: 12, end: 22 });

    // Errors resynced on the next construct-open boundary.
    expect(ast.children[0].position).toEqual({ start: 0, end: 12 });
    expect(ast.children[2].position).toEqual({ start: 22, end: 33 });
  });
});

describe('findErrorNodeAtOffset', () => {
  const source = '{% endfor %} {{ good }} {% endif %}';
  const ast = toResilientLiquidHtmlAST(source);

  it('produces two error nodes spanning up to the next construct boundary', () => {
    const errors = errorNodesOf(ast);
    expect(errors).toHaveLength(2);
    expect(errors[0].position).toEqual({ start: 0, end: 13 });
    expect(errors[1].position).toEqual({ start: 24, end: 35 });
  });

  it('error nodes are first-class, walkable citizens', () => {
    const errors = errorNodesOf(ast);
    expect(isLiquidHtmlNode(errors[0])).toBe(true);
  });

  it('returns the error node the offset sits inside, with its ancestry', () => {
    const result = findErrorNodeAtOffset(ast, 5);
    expect(result).not.toBeNull();
    expect(result!.node.type).toBe(NodeTypes.LiquidErrorNode);
    expect(result!.node.position).toEqual({ start: 0, end: 13 });
    expect(result!.ancestors[0].type).toBe(NodeTypes.Document);
  });

  it('resolves the second error span for an offset inside it', () => {
    const result = findErrorNodeAtOffset(ast, 30);
    expect(result).not.toBeNull();
    expect(result!.node.position).toEqual({ start: 24, end: 35 });
  });

  it('returns null for an offset outside every error span', () => {
    // Offset 17 is inside the recovered {{ good }}, not an error region.
    expect(findErrorNodeAtOffset(ast, 17)).toBeNull();
  });

  it('returns the deepest error node when spans nest', () => {
    const src = 'x'.repeat(20);
    const inner = {
      type: NodeTypes.LiquidErrorNode,
      position: { start: 5, end: 10 },
      source: src,
      message: 'inner',
    } as LiquidErrorNode;
    const container = {
      type: NodeTypes.HtmlElement,
      position: { start: 2, end: 15 },
      source: src,
      children: [inner],
    } as unknown as LiquidHtmlNode;
    const outer = {
      type: NodeTypes.LiquidErrorNode,
      position: { start: 0, end: 20 },
      source: src,
      message: 'outer',
    } as LiquidErrorNode;
    const root = {
      type: NodeTypes.Document,
      name: '#document',
      position: { start: 0, end: 20 },
      source: src,
      _source: src,
      children: [outer, container],
    } as unknown as LiquidHtmlNode;

    const deep = findErrorNodeAtOffset(root, 7);
    expect(deep!.node.message).toBe('inner');
    expect(deep!.ancestors.map((node) => node.type)).toEqual([
      NodeTypes.Document,
      NodeTypes.HtmlElement,
    ]);

    const shallow = findErrorNodeAtOffset(root, 1);
    expect(shallow!.node.message).toBe('outer');
    expect(shallow!.ancestors.map((node) => node.type)).toEqual([NodeTypes.Document]);
  });
});
