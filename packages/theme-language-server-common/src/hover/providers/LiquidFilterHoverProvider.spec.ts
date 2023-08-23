import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: LiquidFilterHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    provider = new HoverProvider(new DocumentManager(), {
      filters: async () => [
        {
          name: 'upcase',
          syntax: 'string | upcase',
          description: 'upcase description',
          return_type: [{ type: 'string', name: '' }],
        },
      ],
      objects: async () => [],
      tags: async () => [],
    });
  });

  it('should return the hover description of the object', async () => {
    const contexts = [
      '{{ foo | upc█ase }}',
      '{{ foo | upcase█ }}',
      '{% echo foo | upcase█ %}',
      '{% liquid\n echo foo | upcase█ %}',
    ];
    for (const context of contexts) {
      await expect(provider).to.hover(context, expect.stringMatching(/##* upcase+: `string`/));
      await expect(provider).to.hover(context, expect.stringContaining('upcase description'));
    }
  });

  it('should return nothing if the thing is unknown', async () => {
    await expect(provider).to.hover(`{{ foo | unknown█ }}`, null);
  });
});
