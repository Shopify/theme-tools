import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildThemeGraph } from '../index';
import { Dependencies, ThemeGraph } from '../types';
import { getDependencies, skeleton } from './test-helpers';

describe('Module: index', () => {
  const rootUri = skeleton;
  let dependencies: Dependencies;

  beforeAll(async () => {
    dependencies = await getDependencies(rootUri);
  }, 15000);

  describe('Unit: buildThemeGraph', { timeout: 10000 }, () => {
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
