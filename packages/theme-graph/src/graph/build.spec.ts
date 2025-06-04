import {
  memoize,
  path as pathUtils,
  SectionSchema,
  SourceCodeType,
  ThemeBlockSchema,
  toSchema,
} from '@shopify/theme-check-common';
import { NodeFileSystem } from '@shopify/theme-check-node';
import path from 'node:path';
import { assert, beforeAll, describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { getWebComponentMap } from '../getWebComponentMap';
import { buildThemeGraph, toSourceCode } from '../index';
import {
  Dependencies,
  JsonModuleKind,
  LiquidModuleKind,
  ModuleType,
  Range,
  ThemeGraph,
  WebComponentMap,
} from '../types';

const fixturesRoot = path.join(__dirname, '../../fixtures');
const skeleton = path.join(fixturesRoot, 'skeleton');
const identity = <T>(x: T): T => x;

describe('Module: index', () => {
  const rootUri = URI.file(skeleton).toString();
  const p = (part: string) => pathUtils.join(rootUri, ...part.split('/'));
  const r = (part: string, range?: Range, indirect?: boolean) => ({
    uri: p(part),
    range,
    indirect,
  });
  let getSourceCode = makeGetSourceCode();
  let webComponentDefs: WebComponentMap;
  let dependencies: Dependencies;

  beforeAll(async () => {
    dependencies = {
      fs: NodeFileSystem,
      getSectionSchema: memoize(async (name: string) => {
        const uri = pathUtils.join(skeleton, 'sections', `${name}.liquid`);
        const sourceCode = await getSourceCode(uri);
        return (await toSchema('theme', uri, sourceCode, async () => true)) as SectionSchema;
      }, identity),
      getBlockSchema: memoize(async (name: string) => {
        const uri = pathUtils.join(skeleton, 'blocks', `${name}.liquid`);
        const sourceCode = await getSourceCode(uri);
        return (await toSchema('theme', uri, sourceCode, async () => true)) as ThemeBlockSchema;
      }, identity),
      getSourceCode,
      getWebComponentDefinitionReference: (customElementName: string) =>
        webComponentDefs.get(customElementName),
    };

    webComponentDefs = await getWebComponentMap(rootUri, dependencies);
  }, 15000);

  describe('Unit: buildThemeGraph', { timeout: 10000 }, () => {
    it('build a graph of the theme', { timeout: 10000 }, async () => {
      const graph = await buildThemeGraph(rootUri, dependencies);
      expect(graph).toBeDefined();
    });

    describe('with a valid theme graph', () => {
      let graph: ThemeGraph;

      beforeAll(async () => {
        graph = await buildThemeGraph(rootUri, dependencies);
      });

      it('have a root URI', () => {
        expect(graph.rootUri).toBeDefined();
        expect(graph.rootUri).toBe(rootUri);
      });

      // We're using sections as entry points because the section rendering API can render
      // any section without it needing a preset or default value in its schema.
      it('infers entry points from the templates folder and section files', () => {
        expect(graph.entryPoints).toHaveLength(3);
        expect(graph.entryPoints.map((x) => x.uri)).toEqual(
          expect.arrayContaining([
            p('templates/index.json'),
            p('sections/custom-section.liquid'),
            p('sections/header.liquid'),
          ]),
        );
      });

      it("finds layout/theme.liquid's dependencies and references", () => {
        const themeLayout = graph.modules[p('layout/theme.liquid')];
        assert(themeLayout);

        // outgoing links
        const deps = themeLayout.dependencies;
        assert(deps.map((x) => x.source.uri).every((x) => x === p('layout/theme.liquid')));
        expect(deps.map((x) => x.target.uri)).toEqual(
          expect.arrayContaining([
            p('sections/header-group.json'),
            p('assets/theme.js'),
            p('assets/theme.css'),
          ]),
        );

        // ingoing links
        const refs = themeLayout.references;
        expect(refs).toHaveLength(1);
        assert(refs.map((x) => x.target.uri).every((x) => x === p('layout/theme.liquid')));
        expect(refs.map((x) => x.source.uri)).toEqual(
          expect.arrayContaining([p('templates/index.json')]),
        );
      });

      it("finds templates/index.json's dependencies and references", () => {
        const indexTemplate = graph.modules[p('templates/index.json')];
        assert(indexTemplate);
        assert(indexTemplate.type === ModuleType.Json);
        assert(indexTemplate.kind === JsonModuleKind.Template);

        // outgoing links
        const deps = indexTemplate.dependencies;
        assert(deps.map((x) => x.source.uri).every((x) => x === p('templates/index.json')));
        expect(deps.map((x) => x.target.uri)).toEqual(
          expect.arrayContaining([
            p('layout/theme.liquid'),
            p('sections/custom-section.liquid'),
            p('blocks/group.liquid'),
            p('blocks/text.liquid'),
          ]),
        );

        // ingoing links
        const refs = indexTemplate.references;
        expect(refs).toHaveLength(0);
      });

      it("finds sections/custom-section's dependencies and references", () => {
        const customSection = graph.modules[p('sections/custom-section.liquid')];
        assert(customSection);
        assert(customSection.type === ModuleType.Liquid);
        assert(customSection.kind === LiquidModuleKind.Section);

        // outgoing links
        const deps = customSection.dependencies;
        assert(deps.map((x) => x.source.uri).every((x) => x === customSection.uri));
        expect(deps.map((x) => x.target.uri)).toEqual(
          expect.arrayContaining([
            p('blocks/group.liquid'),
            p('blocks/text.liquid'),
            p('blocks/_private.liquid'),
          ]),
        );

        // ingoing links
        const refs = customSection.references;
        assert(refs.map((x) => x.target.uri).every((x) => x === customSection.uri));
        expect(refs.map((x) => x.source.uri)).toEqual(
          expect.arrayContaining([p('templates/index.json'), p('sections/header-group.json')]),
        );
        expect(refs).toHaveLength(2);
      });

      it("finds blocks/group's dependencies and references", () => {
        const groupBlock = graph.modules[p('blocks/group.liquid')];
        assert(groupBlock);
        assert(groupBlock.type === ModuleType.Liquid);
        assert(groupBlock.kind === LiquidModuleKind.Block);

        const deps = groupBlock.dependencies;
        assert(deps.map((x) => x.source.uri).every((x) => x === groupBlock.uri));
        expect(deps.map((x) => x.target.uri)).toEqual(
          expect.arrayContaining([p('blocks/text.liquid'), p('snippets/parent.liquid')]),
        );

        const refs = groupBlock.references;
        assert(refs.map((x) => x.target.uri).every((x) => x === groupBlock.uri));
        expect(refs.map((x) => x.source.uri)).toEqual(
          expect.arrayContaining([
            p('templates/index.json'),
            p('sections/custom-section.liquid'), // @theme ref
            p('sections/header-group.json'), // custom-section > group
            p('blocks/group.liquid'), // @theme ref
          ]),
        );

        expect(refs).toContainEqual(
          // Expecting the `@theme` reference in the custom-section schema to be indirect
          expect.objectContaining({
            indirect: true,
            source: {
              uri: p('sections/custom-section.liquid'),
              range: [expect.any(Number), expect.any(Number)],
            },
          }),
        );
      });

      it("finds the snippets/parent's dependencies and references", async () => {
        const parentSnippet = graph.modules[p('snippets/parent.liquid')];
        assert(parentSnippet);
        assert(parentSnippet.type === ModuleType.Liquid);
        assert(parentSnippet.kind === LiquidModuleKind.Snippet);

        // outgoing links
        const deps = parentSnippet.dependencies;
        assert(deps.map((x) => x.source.uri).every((x) => x === parentSnippet.uri));
        expect(deps.map((x) => x.target.uri)).toEqual(
          expect.arrayContaining([
            p('snippets/child.liquid'), // {% render 'child' %}
            p('assets/theme.js'), // <parent-element>
          ]),
        );

        // ingoing links
        const refs = parentSnippet.references;
        assert(refs.map((x) => x.target.uri).every((x) => x === parentSnippet.uri));
        expect(refs.map((x) => x.source.uri)).toEqual(
          expect.arrayContaining([
            p('blocks/group.liquid'), // {% render 'parent' %}
          ]),
        );

        // {% render 'child', children: children %} dependency
        const parentSource = await dependencies.getSourceCode(p('snippets/parent.liquid'));
        assert(parentSource);
        assert(parentSource.type === SourceCodeType.LiquidHtml);
        expect(parentSnippet.dependencies.map((x) => x.source)).toContainEqual(
          expect.objectContaining({
            uri: p('snippets/parent.liquid'),
            range: [
              parentSource.source.indexOf('{% render "child"'),
              parentSource.source.indexOf('{% render "child"') +
                '{% render "child", children: children %}'.length,
            ],
          }),
        );

        // <parent-element> dependency
        expect(parentSnippet.dependencies.map((x) => x.source)).toContainEqual(
          expect.objectContaining({
            uri: p('snippets/parent.liquid'),
            range: [
              parentSource.source.indexOf('<parent-element'),
              parentSource.source.indexOf('<parent-element') + '<parent-element'.length,
            ],
          }),
        );
      });

      it("finds the blocks/_static's dependencies and references", () => {
        const staticBlock = graph.modules[p('blocks/_static.liquid')];
        assert(staticBlock);
        assert(staticBlock.type === ModuleType.Liquid);
        assert(staticBlock.kind === LiquidModuleKind.Block);

        // outgoing links
        const deps = staticBlock.dependencies;
        expect(deps).toEqual([]);

        // ingoing links
        const refs = staticBlock.references;
        assert(refs.map((x) => x.target.uri).every((x) => x === staticBlock.uri));
        expect(refs.map((x) => x.source.uri)).toEqual(
          expect.arrayContaining([
            p('sections/header-group.json'),
            p('blocks/render-static.liquid'),
          ]),
        );
      });
    });
  });

  function makeGetSourceCode() {
    const cache = new Map<string, any>();
    return async function getSourceCode(uri: string) {
      if (cache.has(uri)) {
        return cache.get(uri);
      }
      const source = await NodeFileSystem.readFile(uri);
      const sourceCode = await toSourceCode(URI.file(uri).toString(), source);
      cache.set(uri, sourceCode);
      return sourceCode;
    };
  }
});
