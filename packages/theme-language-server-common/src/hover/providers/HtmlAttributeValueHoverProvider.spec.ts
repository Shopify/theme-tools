import { MetafieldDefinitionMap } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: HtmlAttributeHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    provider = new HoverProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      async (_rootUri: string) => ({}) as MetafieldDefinitionMap,
    );
  });

  it('should return the hover description of the attribute', async () => {
    await expect(provider).to.hover(`<img loading="lazy█">`, expect.stringMatching(/##* lazy/));
    await expect(provider).to.hover(`<img loading='lazy█'>`, expect.stringMatching(/##* lazy/));
    await expect(provider).to.hover(`<img loading=lazy█>`, expect.stringMatching(/##* lazy/));
  });

  it('should return nothing if the thing is unknown', async () => {
    await expect(provider).to.hover(`<img loading="unknown█">`, null);
    await expect(provider).to.hover(`<img loading='unknown█'>`, null);
    await expect(provider).to.hover(`<img loading=unknown█>`, null);
  });
});
