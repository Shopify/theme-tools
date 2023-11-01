import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { HtmlData } from '../../docset';
import { sortByName } from './common';

const allTagNames = [...HtmlData.tags].sort(sortByName).map((x) => x.name);

describe('Module: HtmlTagCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
      },
    });
  });

  it('should complete html tag open names', async () => {
    await expect(provider).to.complete('<█', allTagNames);
    await expect(provider).to.complete(
      '<h█',
      allTagNames.filter((x) => x.startsWith('h')),
    );
  });

  it('should complete void elements with only the void element', async () => {
    await expect(provider).to.complete(
      '<img█',
      allTagNames.filter((x) => x === 'img'),
    );
  });

  it('should complete html tag open names with parent name', async () => {
    await expect(provider).to.complete('<a><', ['/a'].concat(allTagNames));
  });

  it('should complete html tag close with the appropriate dangling parent name', async () => {
    await expect(provider).to.complete('</█', []);
    await expect(provider).to.complete('<h1></h█', ['h1']);
    await expect(provider).to.complete('<h></h█', []); // nothing to complete since closed exactly
  });

  it('should not complete compound html tag names', async () => {
    await expect(provider).to.complete('<{{ thing }}█', []);
    await expect(provider).to.complete('<{{ thing }}h█', []);
  });
});
