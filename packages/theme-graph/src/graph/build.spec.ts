import { path as pathUtils, SourceCodeType } from '@shopify/theme-check-common';
import { assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildThemeGraph } from '../index';
import { Dependencies, JsonModuleKind, LiquidModuleKind, ModuleType, ThemeGraph } from '../types';
import { getDependencies, skeleton } from './test-helpers';

describe('Module: index', () => {
  const rootUri = skeleton;
  const p = (part: string) => pathUtils.join(rootUri, ...part.split('/'));
  const loc = (part: string) => expect.objectContaining({ uri: p(part) });
  let dependencies: Dependencies;

  beforeAll(async () => {
    dependencies = await getDependencies(rootUri);
  }, 15000);

  describe('Unit: buildThemeGraph', { timeout: 10000 }, () => {
    it('build a graph of the theme', { timeout: 10000 }, async () => {
      const graph = await buildThemeGraph(rootUri, dependencies);
      expect(graph).toBeDefined();
    });

    describe('with a valid theme graph', () => {
      let graph: ThemeGraph;

      beforeEach(async () => {
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
        expect(deps).toEqual(
          expect.arrayContaining([
            {
              source: loc('blocks/group.liquid'),
              target: loc('snippets/parent.liquid'),
              type: 'direct',
            }, // direct dep in snippet
            {
              source: loc('blocks/group.liquid'),
              target: loc('blocks/text.liquid'),
              type: 'indirect',
            }, // indirect because of @theme
            {
              source: loc('blocks/group.liquid'),
              target: loc('blocks/text.liquid'),
              type: 'preset',
            }, // direct dep in preset
          ]),
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
            type: 'indirect',
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
});
