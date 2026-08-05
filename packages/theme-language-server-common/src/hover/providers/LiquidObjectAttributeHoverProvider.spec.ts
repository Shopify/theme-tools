import { MetafieldDefinitionMap, ObjectEntry } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

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
            name: 'images',
            description: 'images description',
            return_type: [{ type: 'array', array_value: 'image' }],
          },
          {
            name: 'title',
            return_type: [{ type: 'string', name: '' }],
          },
        ],
      },
      {
        name: 'image',
        description: 'description of the image type',
        properties: [
          {
            name: 'height',
            description: 'height description',
            return_type: [{ type: 'number', name: '' }],
          },
        ],
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
      async (_rootUri: string) => ({}) as MetafieldDefinitionMap,
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

  describe('when hovering over an array built-in method', () => {
    it('should return the hover description of the object property', async () => {
      const contexts = [
        '{{ product.images.█first }}',
        '{{ product.images.first█ }}',
        '{{ product.images.last█ }}',
        '{% echo product.images.first█ %}',
      ];
      for (const context of contexts) {
        await expect(provider).to.hover(
          context,
          expect.stringMatching(/##* (first|last): `image`/),
        );
        await expect(provider, context).to.hover(
          context,
          expect.stringContaining('description of the image type'),
        );
      }
    });

    it('should return not arbitrarily return the type of the last property', async () => {
      await expect(provider).to.hover(
        '{{ product.images.first█.height }}',
        expect.stringMatching(/##* first: `image`/),
      );
      await expect(provider).to.hover(
        '{{ product.images.firs█t.height }}',
        expect.stringMatching(/##* first: `image`/),
      );
    });

    it('should return the hover description number properties', async () => {
      const contexts = ['{{ product.images.size█ }}', '{% echo product.images.size█ %}'];
      for (const context of contexts) {
        await expect(provider).to.hover(context, expect.stringMatching(/##* size: `number`/));
      }
    });

    it('should return nothing if there are no docs for that attribute', async () => {
      const contexts = ['{{ product.images.length█ }}', '{% echo product.images.length█ %}'];
      for (const context of contexts) {
        await expect(provider).to.hover(context, null);
      }
    });
  });

  describe('when hovering over built-in methods of built-in types', () => {
    it('should return info for size', async () => {
      const contexts = [
        '{{ product.title.size█ }}',
        '{{ product.title.first.size█ }}',
        '{% echo product.title.size█ %}',
      ];
      for (const context of contexts) {
        await expect(provider).to.hover(context, expect.stringMatching(/##* size: `number`/));
      }
    });

    it('should return info for first/last of strings', async () => {
      const contexts = [
        '{{ product.title.last█ }}',
        '{{ product.title.first█ }}',
        '{{ product.title.first.first█ }}',
        '{% echo product.title.first█ %}',
      ];
      for (const context of contexts) {
        await expect(provider).to.hover(
          context,
          expect.stringMatching(/##* (first|last): `string`/),
        );
      }
    });

    it('should return nothing for unknown attributes of built-ins', async () => {
      const contexts = ['{{ product.title.length█ }}', '{% echo product.title.unknown█ %}'];
      for (const context of contexts) {
        await expect(provider).to.hover(context, null);
      }
    });
  });

  describe('when the parent is untyped', () => {
    it('should show a hover window (it is like any of any)', async () => {
      await expect(provider).to.hover(
        `{% assign x = product.foo %}
         {{ x.bar█ }}`,
        expect.stringMatching(/##* bar: `untyped`/),
      );
    });
  });

  it('should return nothing if there are no docs for that attribute', async () => {
    await expect(provider).to.hover(`{{ product.featured_foo█ }}`, null);
  });
});
