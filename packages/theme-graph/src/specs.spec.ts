import { Mode, Modes, path, Reference } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { getDependencies } from './graph/test-helpers';
import { buildThemeGraph } from './index';
import { ThemeModule } from './types';

/**
 * Runs the language-neutral graph specs in specs/graph at the repo root.
 * The format is described in specs/graph/README.md.
 */

interface Spec {
  cases: Case[];
}

interface Case {
  name: string;
  mode?: Mode;
  files: Record<string, string>;
  entryPoints?: string[];
  modules?: SpecModule[];
  edges?: SpecEdge[];
}

interface SpecModule {
  file: string;
  type: string;
  kind: string;
  exists?: false;
}

type Position = [line: number, character: number];

interface SpecEdge {
  source: string;
  start?: Position;
  text?: string;
  target: string;
  targetStart?: Position;
  targetText?: string;
  type?: 'indirect' | 'preset';
}

const specsDir = resolve(__dirname, '../../../specs/graph');
const rootUri = path.normalize('file:/');
const caseKeys = ['name', 'mode', 'files', 'entryPoints', 'modules', 'edges'];

for (const specFile of readdirSync(specsDir).filter((f) => f.endsWith('.toml'))) {
  const spec = parse(readFileSync(resolve(specsDir, specFile), 'utf8')) as unknown as Spec;

  describe(`specs/${specFile}`, () => {
    for (const c of spec.cases) {
      it(c.name, async () => {
        // A misspelled optional key would silently check nothing.
        for (const key of Object.keys(c)) expect(caseKeys, 'case keys').toContain(key);
        expect(Modes).toContain(c.mode ?? 'theme');
        const fs = new MockFileSystem(c.files, rootUri);
        const deps = await getDependencies(rootUri, fs);
        const graph = await buildThemeGraph(rootUri, { ...deps, mode: c.mode });
        const modules = Object.values(graph.modules);
        // Each edge is a dependency of its source and a reference of its target.
        for (const module of modules) {
          for (const edge of module.dependencies) {
            expect(edge.source.uri, 'dependency source').toBe(module.uri);
          }
          for (const edge of module.references) {
            expect(edge.target.uri, 'reference target').toBe(module.uri);
          }
        }
        const toSpecEdges = (edges: Reference[]) =>
          edges.map((edge) => toSpecEdge(edge, c.files)).sort(byEdge);
        const edges = toSpecEdges(modules.flatMap((module) => module.dependencies));
        expect(edges).toEqual([...(c.edges ?? [])].sort(byEdge));
        expect(toSpecEdges(modules.flatMap((module) => module.references)), 'references').toEqual(
          edges,
        );
        if (c.entryPoints) {
          expect(graph.entryPoints.map((module) => file(module.uri)).sort()).toEqual(
            [...c.entryPoints].sort(),
          );
        }
        if (c.modules) {
          expect(modules.map(toSpecModule).sort(byFile)).toEqual([...c.modules].sort(byFile));
        }
      });
    }
  });
}

function file(uri: string) {
  return path.relative(uri, rootUri);
}

/** The [line, character] of an offset, both in UTF-16 code units. */
function position(source: string, offset: number): Position {
  const before = source.slice(0, offset);
  return [before.split('\n').length - 1, offset - (before.lastIndexOf('\n') + 1)];
}

function toSpecEdge({ source, target, type }: Reference, files: Case['files']): SpecEdge {
  // Cut out at the range, so with start the text pins it even when the text repeats.
  const at = (uri: string, [start, end]: [number, number]) => {
    expect(end, 'edge end').toBeGreaterThanOrEqual(start);
    return [position(files[file(uri)], start), files[file(uri)].slice(start, end)] as const;
  };
  const [start, text] = source.range ? at(source.uri, source.range) : [];
  const [targetStart, targetText] = target.range ? at(target.uri, target.range) : [];
  return {
    source: file(source.uri),
    ...(start && { start, text }),
    target: file(target.uri),
    ...(targetStart && { targetStart, targetText }),
    ...(type !== 'direct' && { type }),
  };
}

function toSpecModule({ uri, type, kind, exists }: ThemeModule): SpecModule {
  return { file: file(uri), type, kind, ...(exists === false && { exists }) };
}

function byEdge(a: SpecEdge, b: SpecEdge) {
  const key = (e: SpecEdge) =>
    JSON.stringify([e.source, e.start, e.text, e.target, e.targetStart, e.targetText, e.type]);
  return key(a).localeCompare(key(b));
}

function byFile(a: SpecModule, b: SpecModule) {
  return a.file.localeCompare(b.file);
}
