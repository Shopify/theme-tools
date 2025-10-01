import { path } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { URI } from 'vscode-uri';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { ApplyDisableCheckProvider } from './ApplyDisableCheckProvider';

describe('Unit: ApplyDisableCheckProvider', () => {
  const liquidUri = path.normalize(URI.file('/path/to/file.liquid'));
  const liquidContents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  let connection: { sendRequest: Mock; sendDiagnostics: Mock };
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let applyDisableCheckProvider: ApplyDisableCheckProvider;

  beforeEach(() => {
    connection = { sendRequest: vi.fn(), sendDiagnostics: vi.fn() };
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager(connection as any);
    const capabilities = { hasApplyEditSupport: true };
    applyDisableCheckProvider = new ApplyDisableCheckProvider(
      documentManager,
      diagnosticsManager,
      capabilities as any,
      connection as any,
    );
  });

  describe('execute - Liquid files', () => {
    beforeEach(() => {
      documentManager.open(liquidUri, liquidContents, 1);
      diagnosticsManager.set(liquidUri, 1, []);
    });

    it('adds disable-next-line comment with proper indentation', async () => {
      await applyDisableCheckProvider.execute(liquidUri, 1, 'next-line', 'UnusedAssign', 1);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '    {% # theme-check-disable-next-line UnusedAssign %}\n',
                  range: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 0 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('adds disable comment at top of file for file-level disable', async () => {
      await applyDisableCheckProvider.execute(liquidUri, 1, 'file', 'ParserBlockingScript', 0);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '{% # theme-check-disable ParserBlockingScript %}\n',
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('handles lines with no indentation', async () => {
      const noIndentContents = `{% assign x = 1 %}
<script src="2.js"></script>`;
      documentManager.open(liquidUri, noIndentContents, 2);
      diagnosticsManager.set(liquidUri, 2, []);

      await applyDisableCheckProvider.execute(liquidUri, 2, 'next-line', 'UnusedAssign', 0);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 2 },
              edits: [
                {
                  newText: '{% # theme-check-disable-next-line UnusedAssign %}\n',
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('preserves tabs in indentation', async () => {
      const tabContents = `\t\t{% assign x = 1 %}`;
      documentManager.open(liquidUri, tabContents, 3);
      diagnosticsManager.set(liquidUri, 3, []);

      await applyDisableCheckProvider.execute(liquidUri, 3, 'next-line', 'UnusedAssign', 0);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 3 },
              edits: [
                {
                  newText: '\t\t{% # theme-check-disable-next-line UnusedAssign %}\n',
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('uses plain comment format inside liquid tags', async () => {
      const liquidTagContents = `
{% liquid
  assign x = 1
  echo x
%}`;
      documentManager.open(liquidUri, liquidTagContents, 1);
      diagnosticsManager.set(liquidUri, 1, []);

      await applyDisableCheckProvider.execute(liquidUri, 1, 'next-line', 'UnusedAssign', 2);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '  # theme-check-disable-next-line UnusedAssign\n',
                  range: {
                    start: { line: 2, character: 0 },
                    end: { line: 2, character: 0 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('uses regular comment format for file-level disable even inside liquid tags', async () => {
      const liquidTagContents = `
{% liquid
  assign x = 1
  echo x
%}`;
      documentManager.open(liquidUri, liquidTagContents, 1);
      diagnosticsManager.set(liquidUri, 1, []);

      // File-level disable should always use regular format
      await applyDisableCheckProvider.execute(liquidUri, 1, 'file', 'UnusedAssign', 2);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '{% # theme-check-disable UnusedAssign %}\n',
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 0 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('appends to existing disable-next-line comment', async () => {
      const contentsWithComment = `
    {% assign x = 1 %}
    {% # theme-check-disable-next-line UnusedAssign %}
    <script src="2.js"></script>`;
      documentManager.open(liquidUri, contentsWithComment, 1);
      diagnosticsManager.set(liquidUri, 1, []);

      await applyDisableCheckProvider.execute(liquidUri, 1, 'next-line', 'ParserBlockingScript', 3);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText:
                    '{% # theme-check-disable-next-line UnusedAssign, ParserBlockingScript %}',
                  range: {
                    start: { line: 2, character: 4 },
                    end: { line: 2, character: 54 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('appends to existing file-level disable comment', async () => {
      const contentsWithComment = `{% # theme-check-disable UnusedAssign %}
    {% assign x = 1 %}
    <script src="2.js"></script>`;
      documentManager.open(liquidUri, contentsWithComment, 1);
      diagnosticsManager.set(liquidUri, 1, []);

      await applyDisableCheckProvider.execute(liquidUri, 1, 'file', 'ParserBlockingScript', 2);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '{% # theme-check-disable UnusedAssign, ParserBlockingScript %}',
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 40 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('appends to existing liquid tag disable comment', async () => {
      const liquidTagContents = `
{% liquid
  # theme-check-disable-next-line UnusedAssign
  assign x = 1
  echo x
%}`;
      documentManager.open(liquidUri, liquidTagContents, 1);
      diagnosticsManager.set(liquidUri, 1, []);

      await applyDisableCheckProvider.execute(liquidUri, 1, 'next-line', 'LiquidFilter', 3);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '# theme-check-disable-next-line UnusedAssign, LiquidFilter',
                  range: {
                    start: { line: 2, character: 2 },
                    end: { line: 2, character: 46 },
                  },
                },
              ],
            },
          ],
        },
      });
    });

    it('appends to existing disable comment even with blank lines in between', async () => {
      const contentsWithBlankLine = `
    {% # theme-check-disable-next-line MissingTemplate %}

    {% render 'test' %}`;
      documentManager.open(liquidUri, contentsWithBlankLine, 1);
      diagnosticsManager.set(liquidUri, 1, []);

      // Try to disable SyntaxError on line 3
      await applyDisableCheckProvider.execute(liquidUri, 1, 'next-line', 'SyntaxError', 3);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: { uri: liquidUri, version: 1 },
              edits: [
                {
                  newText: '{% # theme-check-disable-next-line MissingTemplate, SyntaxError %}',
                  range: {
                    start: { line: 1, character: 4 },
                    end: { line: 1, character: 57 },
                  },
                },
              ],
            },
          ],
        },
      });
    });
  });
});
