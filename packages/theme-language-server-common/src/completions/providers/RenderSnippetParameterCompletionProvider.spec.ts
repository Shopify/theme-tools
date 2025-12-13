import { describe, beforeEach, it, expect } from 'vitest';
import { CompletionsProvider } from '../CompletionsProvider';
import { DocumentManager } from '../../documents';
import { MetafieldDefinitionMap, DocDefinition } from '@shopify/theme-check-common';

const uri = 'file:///snippets/product-card.liquid';

describe('Module: RenderSnippetParameterCompletionProvider', async () => {
  let provider: CompletionsProvider;
  const mockSnippetName = 'product-card';
  const mockSnippetDefinition: DocDefinition = {
    uri,
    liquidDoc: {
      parameters: [
        {
          name: 'title',
          description: 'The title of the product',
          type: 'string',
          required: true,
          nodeType: 'param',
        },
        {
          name: 'border-radius',
          description: 'The border radius in px',
          type: 'number',
          required: false,
          nodeType: 'param',
        },
        {
          name: 'no-type',
          description: 'This parameter has no type',
          type: null,
          required: true,
          nodeType: 'param',
        },
        {
          name: 'no-description',
          description: null,
          type: 'string',
          required: true,
          nodeType: 'param',
        },
        {
          name: 'no-type-or-description',
          description: null,
          type: null,
          required: true,
          nodeType: 'param',
        },
      ],
    },
  };

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
      getDocDefinitionForURI: async (_uri, _type, snippetName) => {
        if (mockSnippetName === snippetName) {
          return mockSnippetDefinition;
        }
      },
    });
  });

  it("provide completion options that doesn't already exist in render tag", async () => {
    await expect(provider).to.complete(`{% render '${mockSnippetName}', █ %}`, [
      'title',
      'border-radius',
      'no-type',
      'no-description',
      'no-type-or-description',
    ]);
    await expect(provider).to.complete(
      `{% render '${mockSnippetName}', title: 'foo', border-radius: 5, █ %}`,
      ['no-type', 'no-description', 'no-type-or-description'],
    );
  });

  it('does not provide completion options if the snippet does not exist', async () => {
    await expect(provider).to.complete(`{% render 'fake-snippet', █ %}`, []);
  });

  describe('inline snippets', () => {
    it('provide completion options', async () => {
      const content = `
      {% snippet example %}
        {% doc %}
          @param {string} title 
          @param {number} count 
          @param description 
        {% enddoc %}
        <div>{{ title }} - {{ count }}</div>
      {% endsnippet %}

      {% render example, █ %}
    `;
      await expect(provider).to.complete(content, ['title', 'count', 'description']);
    });

    it('provide completion options and exclude already specified params', async () => {
      const content = `
      {% snippet example %}
        {% doc %}
          @param {string} title
          @param {number} count
          @param {boolean} active
        {% enddoc %}
        <div>{{ title }}</div>
      {% endsnippet %}

      {% render example, title: 'foo', █ %}
    `;
      await expect(provider).to.complete(content, ['count', 'active']);
    });

    it('do not provide completion options if there is no doc tag', async () => {
      const content = `
      {% snippet example %}
        <div>No doc block here</div>
      {% endsnippet %}

      {% render example, █ %}
    `;
      await expect(provider).to.complete(content, []);
    });

    it('do not provide completion options if the snippet does not exist', async () => {
      const content = `
      {% snippet example %}
        {% doc %}
          @param {string} title
        {% enddoc %}
      {% endsnippet %}

      {% render nonexistent, █ %}
    `;
      await expect(provider).to.complete(content, []);
    });

    it('provide completion options from the doc tag in the current scope', async () => {
      let content = `
        {% snippet outer %}
          {% doc %}
            @param {string} outerParam
          {% enddoc %}
          {% snippet inner %}
            {% doc %}
              @param {string} innerParam
            {% enddoc %}
            <div>{{ innerParam }}</div>
          {% endsnippet %}
          {% render inner, █ %}
        {% endsnippet %}
      `;
      await expect(provider).to.complete(content, ['innerParam']);
      content = `
        {% snippet outer %}
          {% doc %}
            @param {string} outerParam
          {% enddoc %}
          {% snippet inner %}
            {% doc %}
              @param {string} innerParam
            {% enddoc %}
            <div>{{ innerParam }}</div>
          {% endsnippet %}
        {% endsnippet %}
        {% render outer, █ %}
      `;
      await expect(provider).to.complete(content, ['outerParam']);
    });
  });
});
