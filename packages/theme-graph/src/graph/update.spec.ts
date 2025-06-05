import { path as pathUtils } from '@shopify/theme-check-common';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { Dependencies, ThemeGraph } from '../types';
import { buildThemeGraph } from './build';
import { getDependencies, mockImpl, skeleton } from './test-helpers';
import { updateThemeGraph } from './update';

describe('Unit: updateThemeGraph', () => {
  const rootUri = skeleton;
  const p = (part: string) => pathUtils.join(rootUri, ...part.split('/'));
  let deps: Dependencies;
  let graph: ThemeGraph;

  beforeEach(async () => {
    deps = await getDependencies(rootUri);
    graph = await buildThemeGraph(rootUri, deps);
  }, 10000);

  describe('create file operation', () => {
    it.each([
      {
        desc: 'sections',
        path: 'sections/new-section.liquid',
        expectedDeps: ['snippets/parent.liquid'],
        content: '{% render "parent" %}',
      },
      {
        desc: 'templates',
        path: 'templates/new-section.json',
        expectedDeps: ['sections/custom-section.liquid'],
        content: JSON.stringify({
          order: ['new-section'],
          sections: {
            'new-section': {
              type: 'custom-section',
            },
          },
        }),
      },
    ])(
      'adds new $desc as new entrypoints on the graph and links the new dependencies',
      async ({ path, content, expectedDeps }) => {
        const uri = p(path);

        // Before update, the section is not in the graph
        expect(graph.entryPoints.map((x) => x.uri)).not.toContain(uri);

        // Pretend the file exists
        const { readFile, stat } = mockFsContent(deps, { [uri]: content });

        // Update the graph with a create operation
        await updateThemeGraph(graph, deps, [{ type: 'create', uri: uri }]);

        // After update, the section should be in the graph
        expect(graph.entryPoints.map((x) => x.uri)).toContain(uri);

        // And it should be linked to its dependencies
        const newModule = graph.modules[uri];
        expect(newModule.dependencies.map((x) => x.target.uri)).toEqual(
          expect.arrayContaining(expectedDeps.map((dep) => p(dep))),
        );

        // And its dependencies should be linked to it
        for (const dep of newModule.dependencies) {
          const targetModule = graph.modules[dep.target.uri];
          expect(targetModule.references.map((x) => x.source.uri)).toContain(uri);
        }

        readFile.mockRestore();
        stat.mockRestore();
      },
    );

    it('inserts non-entry modules in the graph', async () => {
      const uri = p('snippets/new-snippet.liquid');
      const content = '{% render "child" %}';
      const { readFile, stat } = mockFsContent(deps, { [uri]: content });

      // Before update, the snippet is not in the graph
      expect(graph.modules[uri]).toBeUndefined();

      // Update the graph with a create operation
      await updateThemeGraph(graph, deps, [{ type: 'create', uri: uri }]);

      // After update, the snippet should be in the graph
      const module = graph.modules[uri];
      assert(module);
      expect(module.dependencies.map((x) => x.target.uri)).toEqual([p('snippets/child.liquid')]);

      readFile.mockRestore();
      stat.mockRestore();
    });

    it('updates exists: false module entries to exists: true and fixes the graph', async () => {
      const files: Record<string, string> = {};
      const parent = p('sections/section1.liquid');
      const child = p('snippets/snip1.liquid');

      // Mock the parent section that points to a dead snippet
      files[parent] = '{% render "snip1" %}';

      {
        const { readFile, stat } = mockFsContent(deps, files);
        await updateThemeGraph(graph, deps, [{ type: 'create', uri: parent }]);

        assert(graph.modules[parent]);
        expect(graph.modules[parent].exists).toBe(true);
        expect(graph.modules[parent].dependencies.map((x) => x.target.uri)).toEqual([child]);
        assert(graph.modules[child]);
        expect(graph.modules[child].exists).toBe(false);

        readFile.mockRestore();
        stat.mockRestore();
      }

      // Pretend the snippet exists now
      files[child] = '{% comment %}This is a snippet{% endcomment %}';

      {
        const { readFile, stat } = mockFsContent(deps, files);
        await updateThemeGraph(graph, deps, [{ type: 'create', uri: child }]);

        assert(graph.modules[parent]);
        expect(graph.modules[parent].exists).toBe(true);
        expect(graph.modules[parent].dependencies.map((x) => x.target.uri)).toEqual([child]);
        assert(graph.modules[child]);
        expect(graph.modules[child].exists).toBe(true);

        readFile.mockRestore();
        stat.mockRestore();
      }
    });
  });

  describe('change file operation', () => {
    it('updates the graph to reflect the new content of the file', async () => {
      const parent = p('snippets/parent.liquid');
      const child = p('snippets/child.liquid');
      const content = ''; // Empty content to remove all dependencies

      // Before update, the snippet has dependencies
      assert(graph.modules[parent]);
      expect(graph.modules[parent].dependencies.map((x) => x.target.uri)).toContain(child);
      expect(graph.modules[child].references.map((x) => x.source.uri)).toContain(parent);

      // Run change update
      const { readFile, stat } = mockFsContent(deps, { [parent]: content });
      await updateThemeGraph(graph, deps, [{ type: 'change', uri: parent }]);

      // After the update, the snippet has no dependencies
      assert(graph.modules[parent]);
      expect(graph.modules[parent].dependencies).not.toContain(child);

      // And the old dependency no longer backlinks to it
      expect(graph.modules[child].references.map((x) => x.source.uri)).not.toContain(parent);

      readFile.mockRestore();
      stat.mockRestore();
    });
  });

  function mockFsContent(deps: Dependencies, defs: Record<string, string>) {
    const readFile = mockImpl(deps.fs, 'readFile', function (original: any, fileUri: string) {
      const content = defs[fileUri];
      if (content !== undefined) {
        return Promise.resolve(content);
      }
      return original(fileUri);
    });

    const stat = mockImpl(deps.fs, 'stat', (original: any, fileUri: string) => {
      if (defs[fileUri] !== undefined) {
        return Promise.resolve();
      }
      return original(fileUri);
    });

    for (const uri of Object.keys(defs)) {
      (deps.getSourceCode as any).invalidate(uri);
    }

    return { readFile, stat };
  }
});
