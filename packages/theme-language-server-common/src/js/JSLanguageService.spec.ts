import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../documents';
import { JSLanguageService } from './JSLanguageService';
import { getRequestParams, isCompletionList } from './test/test-helpers';
import fs from 'fs/promises';
import { FileType } from 'vscode-css-languageservice';

describe('Module: JSLanguageService', () => {
  let jsLanguageService: JSLanguageService;
  let documentManager: DocumentManager;

  beforeEach(async () => {
    documentManager = new DocumentManager(
      undefined,
      undefined,
      undefined,
      async () => 'theme', // theme schema
      async () => false, // invalid
    );
    jsLanguageService = new JSLanguageService(documentManager);

    await jsLanguageService.setup({
      textDocument: {
        completion: {
          contextSupport: true,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown'],
            deprecatedSupport: true,
            preselectSupport: true,
          },
        },
      },
    },
    {
      readFile: (uri) => fs.readFile(uri, 'utf8'),
      readDirectory: (uri) => fs.readdir(uri).then((files) => files.map((file) => [file, 1])),
      stat: (uri) => fs.stat(uri).then((stats) => ({ type: stats.isFile() ? FileType.File : FileType.Directory, size: stats.size })),
    },
    'test/workspace',
    );
  });

  describe('completions', () => {
    it('should return JS completions in a liquid file {% javascript %}', async () => {
      const params = getRequestParams(
        documentManager,
        'sections/section.liquid',
        `
          {% javascript %}
            document.add█
          {% endjavascript %}
          <div>hello world</div>

        `,
      );

      const completions = await jsLanguageService.completions(params);
      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(357);
      expect(completions.items[0].label).to.equal(':active');
      expect(completions.items[0].documentation).to.deep.equal({
        kind: 'markdown',
        value:
          dedent(`Applies while an element is being activated by the user\\. For example, between the times the user presses the mouse button and releases it\\.

(Edge 12, Firefox 1, Safari 1, Chrome 1, IE 4, Opera 5)

[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/:active)`),
      });
    });
  });
});

function dedent(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimStart())
    .join('\n');
}
