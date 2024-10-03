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
        systemTranslations: async () => ({}),
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

  it('should replace the existing attribute partial with the full attribute tag', async () => {
    await expect(provider).to.complete('<text titl█', [
      expect.objectContaining({
        label: 'title',
        textEdit: {
          newText: 'title="$1"$0',
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 10 },
          },
        },
      }),
    ]);
  });

  it('should replace the existing attribute partial with the full attribute tag when cursor is in the middle of attribute partial', async () => {
    await expect(provider).to.complete('<text ti█tl', [
      expect.objectContaining({
        label: 'title',
        textEdit: {
          newText: 'title="$1"$0',
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 10 },
          },
        },
      }),
    ]);
  });

  it('should replace the existing attribute partial with the full attribute tag without value', async () => {
    await expect(provider).to.complete('<button disab█', [
      expect.objectContaining({
        label: 'disabled',
        textEdit: {
          newText: 'disabled',
          range: {
            start: { line: 0, character: 8 },
            end: { line: 0, character: 13 },
          },
        },
      }),
    ]);
  });

  it('should not replace any character if autocomplate is triggered with no attribute partial', async () => {
    await expect(provider).to.complete(
      '<a █',
      [...aTagAttributeNames, ...globalAttributeNames].sort().map((attr) => {
        return expect.objectContaining({
          textEdit: {
            newText: expect.stringContaining(attr),
            range: {
              start: { line: 0, character: 3 },
              end: { line: 0, character: 3 },
            },
          },
        });
      }),
    );
  });

  it('should not replace attribute tags containing liquid code', async () => {
    await expect(provider).to.complete(
      '<a d█ata--{{ echo "coolstuff" }}',
      ['dir', 'download', 'draggable', 'dropzone'].map((attr) => {
        return expect.objectContaining({
          textEdit: {
            newText: expect.stringContaining(attr),
            range: {
              start: { line: 0, character: 3 },
              end: { line: 0, character: 9 },
            },
          },
        });
      }),
    );
  });
});
