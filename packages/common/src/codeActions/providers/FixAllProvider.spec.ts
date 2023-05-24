import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URI } from 'vscode-uri';
import { Offense, SourceCodeType, Severity } from '@shopify/theme-check-common';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { FixAllProvider } from './FixAllProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Unit: FixAllProvider', () => {
  const uri = URI.file('/path/to/file.liquid').toString();
  const contents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const version = 0;
  const document = TextDocument.create(uri, 'liquid', version, contents);
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let fixProvider: FixAllProvider;

  function makeOffense(
    checkName: string,
    needle: string,
    unfixable?: boolean,
  ): Offense<SourceCodeType.LiquidHtml> {
    const start = contents.indexOf(needle);
    const end = start + needle.length;

    return {
      type: SourceCodeType.LiquidHtml,
      check: checkName,
      message: 'Parser blocking script detected',
      absolutePath: '/path/to/file.liquid',
      severity: Severity.ERROR,
      start: { ...document.positionAt(start), index: start },
      end: { ...document.positionAt(end), index: end },
      fix: unfixable ? undefined : (corrector) => corrector.replace(18, 36, 'fixed'),
    };
  }

  beforeEach(() => {
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager({ sendDiagnostics: vi.fn() } as any);
    documentManager.open(uri, contents, version);
    fixProvider = new FixAllProvider(documentManager, diagnosticsManager);
  });

  it('provides a code action to solve all fixable problems', async () => {
    diagnosticsManager.set(uri, version, [
      makeOffense('UnusedAssign', '{% assign x = 1 %}'),
      makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
      makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
    ]);

    const codeActions = fixProvider.codeActions({
      textDocument: { uri },
      range: {
        start: document.positionAt(contents.indexOf('2.js')),
        end: document.positionAt(contents.indexOf('2.js')),
      },
      context: { diagnostics: [] },
    });

    expect(codeActions.length).toBe(1);

    const [fixAllAction] = codeActions;

    expect(fixAllAction).toEqual({
      title: 'Fix all auto-fixable problems',
      kind: 'source.fixAll',
      diagnostics: expect.any(Array),
      isPreferred: false,
      command: {
        title: 'applyFixes',
        command: 'themeCheck/applyFixes',
        arguments: [uri, version, [0, 1, 2]],
      },
    });
  });

  it('does not provide code actions for non-fixable offenses', async () => {
    const nonFixableOffense = makeOffense('ParserBlockingScript', '<script src="2.js">', true);
    diagnosticsManager.set(uri, version, [nonFixableOffense]);

    const codeActions = fixProvider.codeActions({
      textDocument: { uri },
      range: {
        start: document.positionAt(contents.indexOf('2.js')),
        end: document.positionAt(contents.indexOf('2.js')),
      },
      context: { diagnostics: [] },
    });

    expect(codeActions.length).toBe(0);
  });

  it('does provide code action if the selection range does not overlap with the error', async () => {
    diagnosticsManager.set(uri, version, [
      makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
      makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
    ]);

    const codeActions = fixProvider.codeActions({
      textDocument: { uri },
      range: {
        start: document.positionAt(contents.indexOf('assign x = 1')),
        end: document.positionAt(contents.indexOf('= 1')),
      },
      context: { diagnostics: [] },
    });

    expect(codeActions.length).toBe(1);
  });
});
