import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';

describe('Module: ObjectCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider(new DocumentManager(), {
      filters: async () => [],
      objects: async () => [{ name: 'all_products' }, { name: 'global' }],
      tags: async () => [],
    });
  });

  it('should complete variable lookups', async () => {
    const contexts = [
      `{{ a█`,
      `{% echo a█ %}`,
      `{% assign x = a█ %}`,
      `{% for a in a█ %}`,
      `{% for a in b reversed limit: a█ %}`,
      `{% paginate b by a█ %}`,
      `{% paginate b by col, window_size: a█ %}`,
      `{% if a█ %}`,
      `{% if a > a█ %}`,
      `{% if a > b or a█ %}`,
      `{% if a > b or c > a█ %}`,
      `{% elsif a > a█ %}`,
      `{% when a█ %}`,
      `{% when a, a█ %}`,
      `{% cycle a█ %}`,
      `{% cycle 'foo', a█ %}`,
      `{% cycle 'foo': a█ %}`,
      `{% render 'snip', var: a█ %}`,
      `{% render 'snip' for a█ as item %}`,
      `{% render 'snip' with a█ as name %}`,
      `{% for x in (1..a█) %}`,
      // `{% paginate a█ by 50 %}`,
      `<a-{{ a█ }}`,
      `<a data-{{ a█ }}`,
      `<a data={{ a█ }}`,
      `<a data="{{ a█ }}"`,
      `<a data='x{{ a█ }}'`,
    ];
    await Promise.all(
      contexts.map((context) => expect(provider, context).to.complete(context, ['all_products'])),
    );
  });

  it('should complete variable lookups (placeholder mode)', async () => {
    const contexts = [
      `{{ █`,
      `{% echo █ %}`,
      `{% assign x = █ %}`,
      `{% for a in █ %}`,
      `{% for a in b reversed limit: █ %}`,
      `{% paginate b by █ %}`,
      `{% paginate b by col, window_size: █ %}`,
      `{% if █ %}`,
      `{% if a > █ %}`,
      `{% if a > b or █ %}`,
      `{% if a > b or c > █ %}`,
      `{% elsif a > █ %}`,
      `{% when █ %}`,
      `{% when a, █ %}`,
      `{% cycle █ %}`,
      `{% cycle 'foo', █ %}`,
      `{% cycle 'foo': █ %}`,
      `{% render 'snip', var: █ %}`,
      `{% render 'snip' for █ as item %}`,
      `{% render 'snip' with █ as name %}`,
      `{% for x in (1..█) %}`,
      // `{% paginate █ by 50 %}`,
      `<a-{{ █ }}`,
      `<a data-{{ █ }}`,
      `<a data={{ █ }}`,
      `<a data="{{ █ }}"`,
      `<a data='x{{ █ }}'`,
    ];

    await Promise.all(
      contexts.map((context) =>
        expect(provider, context).to.complete(context, ['all_products', 'global']),
      ),
    );
  });

  it('should not complete anything if there is nothing to complete', async () => {
    await expect(provider).to.complete('{% assign x = "█" %}', []);
  });
});
