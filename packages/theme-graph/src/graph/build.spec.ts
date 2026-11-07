import { path, SourceCodeType } from '@shopify/theme-check-common';
import { assert, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildThemeGraph } from '../index';
import { toSourceCode } from '../toSourceCode';
import { Dependencies, ThemeGraph } from '../types';
import { serializeThemeGraph } from './serialize';
import { getDependencies, skeleton } from './test-helpers';

describe('Module: index', () => {
  const rootUri = skeleton;
  const p = (...parts: string[]) => path.join(rootUri, ...parts);
  let dependencies: Dependencies;

  beforeAll(async () => {
    dependencies = await getDependencies(rootUri);
  }, 15000);

  describe('Unit: buildThemeGraph', { timeout: 10000 }, () => {
    it('reports Liquid files that fail to parse', async () => {
      const uri = p('sections/custom-section.liquid');
      const brokenSource = await toSourceCode(
        uri,
        `{{ 'used-by-broken.css' | asset_url | stylesheet_tag }}\n{% if true %}<div class="a {% endif %}">x</div>`,
      );
      assert(brokenSource.type === SourceCodeType.LiquidHtml);
      assert(brokenSource.ast instanceof Error);

      const graph = await buildThemeGraph(
        rootUri,
        {
          ...dependencies,
          getSourceCode: async (sourceUri) =>
            sourceUri === uri ? brokenSource : dependencies.getSourceCode(sourceUri),
        },
        [uri],
      );

      expect(graph.parseErrors).toEqual([
        expect.objectContaining({ uri, message: expect.any(String) }),
      ]);
      expect(graph.modules[p('assets/used-by-broken.css')]).toBeUndefined();
      expect(serializeThemeGraph(graph).parseErrors).toEqual(graph.parseErrors);
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
    });
  });
});
