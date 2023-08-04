import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { tags } from './LiquidTagsCompletionProvider.spec.fixtures';

describe('Module: LiquidTagsCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider(new DocumentManager(), {
      filters: async () => [],
      objects: async () => [],
      tags: async () => tags,
    });
  });

  it('should complete Liquid tags', async () => {
    await expect(provider).to.complete('{% comm', ['comment']);
    await expect(provider).to.complete('{% com', ['comment']);
    await expect(provider).to.complete('{% re', ['render']);
    await expect(provider).to.complete('{% ren', ['render']);
    await expect(provider).to.complete('{% rend', ['render']);
    await expect(provider).to.complete('{% fo', ['for']);
  });

  it('should complete end tags with the correct thing', async () => {
    await expect(provider).to.complete('{% comment %} hello there {% end', ['endcomment']);
    await expect(provider).to.complete('{% if cond %} hello {% else %} then {% end', ['endif']);
    await expect(provider).to.complete('{% for i in (1..3) %}{% end', ['endfor']);
    await expect(provider).to.complete('{% javascript %} console.log("hi") {% end', [
      'endjavascript',
    ]);
    await expect(provider).to.complete('{% form "cart", cart %} ... {% end', ['endform']);
  });

  it('should not complete anything if the partial end tag does not match', async () => {
    await expect(provider).to.complete('{% comment %} hello there {% endz', []);
    await expect(provider).to.complete('{% if cond %} hello {% else %} then {% endz', []);
    await expect(provider).to.complete('{% for i in (1..3) %}{% endz', []);
    await expect(provider).to.complete('{% javascript %} console.log("hi") {% endz', []);
    await expect(provider).to.complete('{% form "cart", cart %} ... {% endz', []);
  });

  it('should complete empty statements', async () => {
    await expect(provider).to.complete('{% ', ['comment', 'for', 'render']);
  });

  it('should not complete when the cursor position is not on the name', async () => {
    await expect(provider).to.complete('{% for i in (1..3)█', []);
    await expect(provider).to.complete('{% for i in (1..3) █', []);
    await expect(provider).to.complete('{% for i in (1..3) %}█', []);
    await expect(provider).to.complete('{% for i in (1..3) %} hi {% endfor %}█', []);
    await expect(provider).to.complete('{% for i in (1..3) %} hi {% endfor %}█', []);
    await expect(provider).to.complete('{% render "snip█', []);
  });

  it('should complete completed tags', async () => {
    await expect(provider).to.complete('{% for█ i in (1..3)', ['for']);
    await expect(provider).to.complete('{% render█ "markup"', ['render']);
  });
});
