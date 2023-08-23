import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: LiquidTagHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    provider = new HoverProvider(new DocumentManager(), {
      filters: async () => [],
      objects: async () => [],
      tags: async () => [
        { name: 'if', description: 'if statement description' },
        { name: 'echo', description: 'echo description' },
      ],
    });
  });

  it('should return the hover description of the correct tag', async () => {
    await expect(provider).to.hover(`{%█ if cond %}{% endif %}`, expect.stringContaining('if'));
    await expect(provider).to.hover(`{% i█f cond %}{% endif %}`, expect.stringContaining('if'));
    await expect(provider).to.hover(`{% if█ cond %}{% endif %}`, expect.stringContaining('if'));
    await expect(provider).to.hover(`{% if cond █%}{% endif %}`, expect.stringContaining('if'));
    await expect(provider).to.hover(`{% if cond %}{% █ endif %}`, expect.stringContaining('if'));
    await expect(provider).to.hover(`{% echo█ 'hi' %}`, expect.stringContaining('echo'));
  });

  it('should not return the tag hover description when hovering over anything else in the tag', async () => {
    await expect(provider).to.not.hover(`{% if █cond %}{% endif %}`, expect.stringContaining('if'));
    await expect(provider).to.not.hover(`{% if c█ond %}{% endif %}`, expect.stringContaining('if'));
    await expect(provider).to.not.hover(
      `{% if cond %} █ {%  endif %}`,
      expect.stringContaining('if'),
    );
  });

  it('should return nothing if there are no docs for that tag', async () => {
    await expect(provider).to.hover(`{% unknown█ %}`, null);
  });
});
