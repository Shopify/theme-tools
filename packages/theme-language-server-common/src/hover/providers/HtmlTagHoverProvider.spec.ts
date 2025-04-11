import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';
import { MetafieldDefinitionMap } from '@shopify/theme-check-common';

describe('Module: HtmlTagHoverProvider', async () => {
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
      async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    );
  });

  it('should return the hover description of the tag', async () => {
    await expect(provider).to.hover(`<a█ href="..."></a>`, expect.stringMatching(/##* a/));
    await expect(provider).to.hover(`<img█ src="...">`, expect.stringMatching(/##* img/));
    await expect(provider).to.hover(`<img█ src="..."/>`, expect.stringMatching(/##* img/));
    await expect(provider).to.hover(`<i█mg src="...">`, expect.stringMatching(/##* img/));
    await expect(provider).to.hover(`<img src="..." █>`, expect.stringMatching(/##* img/));
  });

  it('should return nothing if the thing is unknown', async () => {
    await expect(provider).to.hover(`<unknown█ ></unknown>`, null);
    await expect(provider).to.hover(`<unknown█ />`, null);
  });
});
