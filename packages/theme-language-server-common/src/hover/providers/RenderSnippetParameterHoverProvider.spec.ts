import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { GetSnippetDefinitionForURI, SnippetDefinition } from '@shopify/theme-check-common';
import '../../../../theme-check-common/src/test/test-setup';

describe('Module: RenderSnippetParameterHoverProvider', async () => {
  let provider: HoverProvider;
  let getSnippetDefinition: GetSnippetDefinitionForURI;
  const mockSnippetDefinition: SnippetDefinition = {
    name: 'product-card',
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

  describe('hover', () => {
    beforeEach(() => {
      provider = createProvider(async () => mockSnippetDefinition);
    });

    it('should return null if snippet definition not found', async () => {
      getSnippetDefinition = async () => undefined;
      provider = createProvider(getSnippetDefinition);
      await expect(provider).to.hover(`{% render 'product-card' tit█le: 'value' %}`, null);
    });

    // should return null if no parameters are defined
    it('should return null if no parameters are defined in liquidDoc', async () => {
      getSnippetDefinition = async () => ({
        name: 'product-card',
        liquidDoc: {
          parameters: [],
        },
      });
      provider = createProvider(getSnippetDefinition);
      await expect(provider).to.hover(`{% render 'product-card' tit█le: 'value' %}`, null);
    });

    it('should return null if parameter not found in snippet definition', async () => {
      await expect(provider).to.hover(`{% render 'product-card' unknown-para█m: 'value' %}`, null);
    });

    it('should return parameter info with type and description', async () => {
      await expect(provider).to.hover(
        `{% render 'product-card' ti█tle: 'My Product' %}`,
        '### `title`: string\n\nThe title of the product',
      );
    });

    it('should return parameter info with only type', async () => {
      await expect(provider).to.hover(
        `{% render 'product-card' no-descri█ption: 'value' %}`,
        '### `no-description`: string',
      );
    });

    it('should return parameter info with only description', async () => {
      await expect(provider).to.hover(
        `{% render 'product-card' no-ty█pe: 'value' %}`,
        '### `no-type`\n\nThis parameter has no type',
      );
    });

    it('should return only parameter name when no type or description', async () => {
      await expect(provider).to.hover(
        `{% render 'product-card' no-type-or-descri█ption: 'value' %}`,
        '### `no-type-or-description`',
      );
    });
  });
});

const createProvider = (getSnippetDefinition: GetSnippetDefinitionForURI) => {
  return new HoverProvider(
    new DocumentManager(),
    {
      filters: async () => [],
      objects: async () => [],
      liquidDrops: async () => [],
      tags: async () => [],
      systemTranslations: async () => ({}),
    },
    async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    async () => ({}),
    async () => [],
    getSnippetDefinition,
  );
};
