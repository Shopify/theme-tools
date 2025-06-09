import { path as pathUtils } from '@shopify/theme-check-common';
import { describe, expect, it } from 'vitest';
import { ThemeGraph } from '../types';
import { getSectionModule, getSnippetModule, getTemplateModule } from './module';
import { serializeThemeGraph } from './serialize';
import { bind } from './traverse';

describe('Unit: serializeThemeGraph', () => {
  it('serialize the graph', () => {
    const rootUri = 'file:///theme';
    const p = (part: string) => pathUtils.join(rootUri, part);
    const graph: ThemeGraph = {
      entryPoints: [],
      modules: {},
      rootUri,
    };

    const template = getTemplateModule(graph, p('templates/index.json'));
    const customSection = getSectionModule(graph, 'custom-section');
    const parentSnippet = getSnippetModule(graph, 'parent');
    const childSnippet = getSnippetModule(graph, 'child');
    bind(template, customSection, { sourceRange: [0, 5] });
    bind(customSection, parentSnippet, { sourceRange: [10, 15] });
    bind(parentSnippet, childSnippet, { sourceRange: [20, 25] });

    const section2 = getSectionModule(graph, 'section2');
    bind(template, section2, { sourceRange: [20, 25] });

    graph.entryPoints = [template];
    [template, customSection, section2, parentSnippet, childSnippet].forEach((module) => {
      graph.modules[module.uri] = module;
    });

    const { nodes, edges } = serializeThemeGraph(graph);
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(4);
    expect(edges).toEqual(
      expect.arrayContaining([
        {
          source: { uri: 'file:///theme/templates/index.json', range: [0, 5] },
          target: { uri: 'file:///theme/sections/custom-section.liquid' },
          type: 'direct',
        },
        {
          source: { uri: 'file:///theme/sections/custom-section.liquid', range: [10, 15] },
          target: { uri: 'file:///theme/snippets/parent.liquid' },
          type: 'direct',
        },
        {
          source: { uri: 'file:///theme/snippets/parent.liquid', range: [20, 25] },
          target: { uri: 'file:///theme/snippets/child.liquid' },
          type: 'direct',
        },
        {
          source: { uri: 'file:///theme/templates/index.json', range: [20, 25] },
          target: { uri: 'file:///theme/sections/section2.liquid' },
          type: 'direct',
        },
      ]),
    );
  });
});
