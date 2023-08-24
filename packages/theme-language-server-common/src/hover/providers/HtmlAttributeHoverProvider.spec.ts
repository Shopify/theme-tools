import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: HtmlAttributeHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    provider = new HoverProvider(new DocumentManager(), {
      filters: async () => [],
      objects: async () => [],
      tags: async () => [],
    });
  });

  it('should return the hover description of the attribute', async () => {
    await expect(provider).to.hover(`<a hr█ef="..."></a>`, expect.stringMatching(/##* href/));
    await expect(provider).to.hover(`<a href█="..."></a>`, expect.stringMatching(/##* href/));
    await expect(provider).to.hover(`<img src█="...">`, expect.stringMatching(/##* src/));
    await expect(provider).to.hover(`<img src█='...'>`, expect.stringMatching(/##* src/));
    await expect(provider).to.hover(`<img src█=...>`, expect.stringMatching(/##* src/));
    await expect(provider).to.hover(`<img src█>`, expect.stringMatching(/##* src/));
  });

  it('should return nothing if the thing is unknown', async () => {
    await expect(provider).to.hover(`<a unkn█own></a>`, null);
  });
});
