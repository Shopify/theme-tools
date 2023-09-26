import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { HoverProvider } from '../HoverProvider';

describe('Module: TranslationHoverProvider', async () => {
  let provider: HoverProvider;

  beforeEach(async () => {
    provider = new HoverProvider(
      new DocumentManager(),
      {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
      },
      async () => ({
        general: {
          password: 'password',
          username_html: '<b>username</b>',
          comments: {
            one: '{{ count }} comment',
            other: '{{ count }} comments',
          },
        },
      }),
    );
  });

  it('should return the hover description of the translation string', async () => {
    await expect(provider).to.hover(`{{ '█general.password' | t }}`, 'password');
    await expect(provider).to.hover(
      `{{ 'general█.username_html' | t }}`,
      expect.stringMatching('<b>username</b>'),
    );
    await expect(provider).to.hover(
      `{{ 'general█.comments' | translate }}`,
      expect.stringMatching(/one(.|\n)*comment(.|\n)*other(.|\n)*comments/),
    );
  });

  it('should return nothing if there are no translations for that string', async () => {
    await expect(provider).to.hover(`{{ 'general.█password' | not_a_translation_filter }}`, null);
    await expect(provider).to.hover(`{{ 'general.█nope' | t }}`, null);
  });
});
