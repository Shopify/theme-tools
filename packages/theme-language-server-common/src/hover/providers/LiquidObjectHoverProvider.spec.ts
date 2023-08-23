import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: LiquidObjectHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    provider = new HoverProvider(new DocumentManager(), {
      filters: async () => [],
      objects: async () => [
        {
          name: 'product',
          description: 'product description',
          return_type: [],
          properties: [
            {
              name: 'featured_image',
              return_type: [{ type: 'image', name: '' }],
            },
            {
              name: 'title',
              return_type: [{ type: 'string', name: '' }],
            },
          ],
        },
        {
          name: 'all_products',
          return_type: [{ type: 'array', array_value: 'product' }],
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
      ],
      tags: async () => [],
    });
  });

  it('should return the hover description of the object', async () => {
    const contexts = [
      '{{ pro█duct }}',
      '{{ product█ }}',
      '{% echo product█ %}',
      '{% liquid\n echo product█ %}',
      '{% assign x = product %}{{ x█ }}',
      '{% for x in all_products %}{{ x█ }}{% endfor %}',
      '{% assign x = all_products[0] %}{{ x█ }}',
    ];
    for (const context of contexts) {
      await expect(provider).to.hover(context, expect.stringContaining('product description'));
      await expect(provider).to.hover(context, expect.stringMatching(/##* \w+: `product`/));
    }
  });

  it('should return nothing if the thing is untyped', async () => {
    await expect(provider).to.hover(`{{ unknown█ }}`, null);
  });
});
