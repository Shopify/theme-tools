import { Offense, Severity, SourceCodeType, path } from '@shopify/theme-check-common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { DisableCheckProvider } from './DisableCheckProvider';

describe('Unit: DisableCheckProvider', () => {
  const uri = path.normalize(URI.file('/path/to/file.liquid'));
  const contents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const version = 0;
  const document = TextDocument.create(uri, 'liquid', version, contents);
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let provider: DisableCheckProvider;

  function makeOffense(
    checkName: string,
    needle: string,
  ): Offense<SourceCodeType.LiquidHtml> {
    const start = contents.indexOf(needle);
    const end = start + needle.length;
    return {
      type: SourceCodeType.LiquidHtml,
      check: checkName,
      message: `${checkName} problem`,
      uri: 'file:///path/to/file.liquid',
      severity: Severity.ERROR,
      start: { ...document.positionAt(start), index: start },
      end: { ...document.positionAt(end), index: end },
    };
  }

  function cursorAt(needle: string) {
    return {
      textDocument: { uri },
      range: {
        start: document.positionAt(contents.indexOf(needle)),
        end: document.positionAt(contents.indexOf(needle)),
      },
      context: { diagnostics: [] },
    };
  }

  beforeEach(() => {
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager({ sendDiagnostics: vi.fn() } as any);
    documentManager.open(uri, contents, version);
    provider = new DisableCheckProvider(documentManager, diagnosticsManager);
  });

  it('offers "disable for this line" inserting a disable-next-line comment above the offense, indent-matched', () => {
    diagnosticsManager.set(uri, version, [makeOffense('UnusedAssign', '{% assign x = 1 %}')]);

    const codeActions = provider.codeActions(cursorAt('assign x = 1'));
    const action = codeActions.find((a) => a.title === 'Disable UnusedAssign for this line');

    expect(action).toEqual({
      title: 'Disable UnusedAssign for this line',
      kind: 'quickfix',
      diagnostics: expect.any(Array),
      isPreferred: false,
      edit: {
        changes: {
          [uri]: [
            {
              range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 0 },
              },
              newText: '    {% # theme-check-disable-next-line UnusedAssign %}\n',
            },
          ],
        },
      },
    });
  });

  it('offers "disable for entire file" inserting a disable comment at the top of the file', () => {
    diagnosticsManager.set(uri, version, [makeOffense('UnusedAssign', '{% assign x = 1 %}')]);

    const codeActions = provider.codeActions(cursorAt('assign x = 1'));
    const action = codeActions.find((a) => a.title === 'Disable UnusedAssign for entire file');

    expect(action).toEqual({
      title: 'Disable UnusedAssign for entire file',
      kind: 'quickfix',
      diagnostics: expect.any(Array),
      isPreferred: false,
      edit: {
        changes: {
          [uri]: [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
              newText: '{% # theme-check-disable UnusedAssign %}\n',
            },
          ],
        },
      },
    });
  });

  it('offers no actions when the cursor does not overlap any offense', () => {
    diagnosticsManager.set(uri, version, [
      makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
    ]);

    const codeActions = provider.codeActions(cursorAt('assign x = 1'));

    expect(codeActions.length).toBe(0);
  });
});
