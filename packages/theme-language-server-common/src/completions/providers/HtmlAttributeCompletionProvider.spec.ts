import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { HtmlData } from '../../docset';
import { sortByName } from './common';

const globalAttributeNames = [...HtmlData.globalAttributes].sort(sortByName).map((x) => x.name);
const aTag = HtmlData.tags.find((x) => x.name === 'a')!;
const aTagAttributeNames = aTag.attributes.map((x) => x.name);

describe('Module: HtmlAttributeCompletionProvider', async () => {
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

  it('should complete unknown tag attributes with global attribute', async () => {
    await expect(provider).to.complete('<unknown █', globalAttributeNames);
  });

  it("should complete known tags attribute with global attribute names + the tag's attributes", async () => {
    const expected = [...aTagAttributeNames, ...globalAttributeNames].sort();
    await expect(provider).to.complete('<a █', expected);
  });

  it('should complete correctly inside if branches as well!', async () => {
    const expected = [...aTagAttributeNames, ...globalAttributeNames].sort();
    await expect(provider).to.complete('<a {% if cond %}█', expected);
  });
});
