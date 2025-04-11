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
});
