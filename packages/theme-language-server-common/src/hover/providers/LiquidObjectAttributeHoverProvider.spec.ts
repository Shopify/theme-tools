import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap, ObjectEntry } from '@shopify/theme-check-common';

describe('Module: LiquidObjectAttributeHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    const _objects: ObjectEntry[] = [
      {
        name: 'product',
        description: 'product description',
        return_type: [],
        properties: [
          {
            name: 'featured_image',
            description: 'featured_image description',
            return_type: [{ type: 'image', name: '' }],
          },
          {
            name: 'title',
            return_type: [{ type: 'string', name: '' }],
          },
        ],
      },
      {
        name: 'image',
        description: 'image description',
        access: {
          global: false,
          parents: [],
          template: [],
        },
      },
    ];

    provider = new HoverProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => _objects,
        liquidDrops: async () => _objects,
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    );
  });

  it('should return the hover description of the object property', async () => {
    const contexts = [
      '{{ product.feat█ured_image }}',
      '{{ product.featured_image█ }}',
      '{% echo product.featured_image█ %}',
      '{% liquid\n echo product.featured_image█ %}',
    ];
    for (const context of contexts) {
      await expect(provider).to.hover(
        context,
        expect.stringContaining('featured_image description'),
      );
      await expect(provider).to.hover(
        context,
        expect.stringMatching(/##* featured_image: `image`/),
      );
    }
  });

  it('should return nothing if there are no docs for that attribute', async () => {
    await expect(provider).to.hover(`{{ product.featured_foo█ }}`, null);
  });
});
