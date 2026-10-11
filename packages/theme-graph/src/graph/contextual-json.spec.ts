import { path as pathUtils } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { describe, expect, it } from 'vitest';
import { buildThemeGraph } from '../index';
import { ThemeGraph } from '../types';
import { getDependencies } from './test-helpers';

describe('contextual JSON modules', () => {
  const rootUri = 'file:///theme';
  const p = (part: string) => pathUtils.join(rootUri, ...part.split('/'));

  async function buildJsonModule(
    relativePath: string,
    source: object,
    options: { additionalFiles?: Record<string, string>; explicitEntry?: boolean } = {},
  ): Promise<ThemeGraph> {
    const fs = new MockFileSystem(
      {
        'assets/theme.js': '',
        'layout/theme.liquid': '',
        'sections/hero.liquid': `{% schema %}
          { "name": "Hero", "blocks": [{ "type": "@theme" }] }
        {% endschema %}`,
        'blocks/group.liquid': `{% schema %}
          { "name": "Group", "blocks": [{ "type": "@theme" }] }
        {% endschema %}`,
        ...options.additionalFiles,
        [relativePath]: JSON.stringify(source),
      },
      rootUri,
    );
    const dependencies = await getDependencies(rootUri, fs);
    const entryPoints = options.explicitEntry === false ? undefined : [p(relativePath)];

    return buildThemeGraph(rootUri, dependencies, entryPoints);
  }

  function expectNoUndefinedModules(graph: ThemeGraph) {
    expect(Object.keys(graph.modules)).not.toContain(p('sections/undefined.liquid'));
    expect(Object.keys(graph.modules)).not.toContain(p('blocks/undefined.liquid'));
  }

  it('skips a contextual template section that inherits its type', async () => {
    const baseTemplateUri = p('templates/index.json');
    const graph = await buildJsonModule(
      'templates/index.context.ca.json',
      {
        context: { market: 'ca' },
        parent: 'index.json',
        sections: { hero: { settings: { heading: 'Canada' } } },
      },
      {
        additionalFiles: {
          'templates/index.json': JSON.stringify({ sections: { hero: { type: 'hero' } } }),
        },
        explicitEntry: false,
      },
    );

    expect(graph.modules[baseTemplateUri].dependencies.map(({ target }) => target.uri)).toContain(
      p('sections/hero.liquid'),
    );
    expectNoUndefinedModules(graph);
  });

  it('skips a contextual section-group section that inherits its type', async () => {
    const graph = await buildJsonModule('sections/header-group.context.ca.json', {
      context: { market: 'ca' },
      parent: 'header-group.json',
      sections: { header: { settings: { sticky: true } } },
    });

    expectNoUndefinedModules(graph);
  });

  it('keeps the section edge while skipping a block that inherits its type', async () => {
    const moduleUri = p('sections/header-group.context.ca.json');
    const graph = await buildJsonModule('sections/header-group.context.ca.json', {
      sections: {
        header: {
          type: 'hero',
          blocks: { inherited: { settings: { text: 'Canada' } } },
        },
      },
    });

    expect(graph.modules[moduleUri].dependencies.map(({ target }) => target.uri)).toContain(
      p('sections/hero.liquid'),
    );
    expectNoUndefinedModules(graph);
  });

  it('keeps valid edges while skipping a nested block that inherits its type', async () => {
    const moduleUri = p('sections/header-group.context.ca.json');
    const graph = await buildJsonModule('sections/header-group.context.ca.json', {
      sections: {
        header: {
          type: 'hero',
          blocks: {
            group: {
              type: 'group',
              blocks: { inherited: { settings: { text: 'Canada' } } },
            },
          },
        },
      },
    });

    expect(graph.modules[moduleUri].dependencies.map(({ target }) => target.uri)).toEqual(
      expect.arrayContaining([p('sections/hero.liquid'), p('blocks/group.liquid')]),
    );
    expectNoUndefinedModules(graph);
  });
});
