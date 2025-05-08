import { describe, beforeEach, it, expect } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: LiquidDocTagCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it('offers completions within liquid doc tag for snippets', async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://snippets/file.liquid' },
      ['param', 'example', 'description'],
    );
    await expect(provider).to.complete(
      { source: `{% doc %} @par█`, relativePath: 'file://snippets/file.liquid' },
      ['param'],
    );
  });

  it('offers completions within liquid doc tag for blocks', async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://blocks/file.liquid' },
      ['param', 'example', 'description'],
    );
  });

  it("does not offer completion if it doesn't start with @", async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} █`, relativePath: 'file://snippets/file.liquid' },
      [],
    );
  });

  it('does not offer completion if it is not within a doc tag', async () => {
    await expect(provider).to.complete(
      { source: `{% notdoc %} @█`, relativePath: 'file://snippets/file.liquid' },
      [],
    );
  });

  it('does not offer completion if it is not a snippet file or block', async () => {
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://sections/file.liquid' },
      [],
    );
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://templates/file.liquid' },
      [],
    );
    await expect(provider).to.complete(
      { source: `{% doc %} @█`, relativePath: 'file://layout/file.liquid' },
      [],
    );
  });

  describe('nodes that accept free-form text', () => {
    it('offers completions when @ is at the start of a new line following an implicit description', async () => {
      await expect(provider).to.complete(
        {
          source: `{% doc %}
          This is an implicit description
          @█`,
          relativePath: 'file://snippets/file.liquid',
        },
        ['param', 'example', 'description'],
      );
    });

    it('offers completions when @ is at the start of a new line following a node that accepts free-form text', async () => {
      await expect(provider).to.complete(
        {
          source: `{% doc %}
          @prompt Text
          @█`,
          relativePath: 'file://snippets/file.liquid',
        },
        ['param', 'example', 'description'],
      );

      await expect(provider).to.complete(
        {
          source: `{% doc %}
          @description Text
          @█`,
          relativePath: 'file://snippets/file.liquid',
        },
        ['param', 'example', 'description'],
      );

      await expect(provider).to.complete(
        {
          source: `{% doc %}
          @example Text
          @█`,
          relativePath: 'file://snippets/file.liquid',
        },
        ['param', 'example', 'description'],
      );
    });

    it('does not offer completions when @ is not at the start of a line', async () => {
      await expect(provider).to.complete(
        {
          source: `{% doc %}
          @prompt This is a promptwith @█`,
          relativePath: 'file://snippets/file.liquid',
        },
        [],
      );
      await expect(provider).to.complete(
        {
          source: `{% doc %}
          @description This is a description with @█`,
          relativePath: 'file://snippets/file.liquid',
        },
        [],
      );

      await expect(provider).to.complete(
        {
          source: `{% doc %}
          @example Here is an example with @`,
          relativePath: 'file://snippets/file.liquid',
        },
        [],
      );
    });
  });
});
