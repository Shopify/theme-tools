import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URI } from 'vscode-uri';
import { Offense, SourceCodeType, Severity, Suggestion } from '@shopify/theme-check-common';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { SuggestionProvider } from './SuggestionProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Unit: SuggestionProvider', () => {
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
  let suggestionProvider: SuggestionProvider;

  function makeOffense(
    checkName: string,
    needle: string,
    unfixable?: boolean,
  ): Offense<SourceCodeType.LiquidHtml> {
    const start = contents.indexOf(needle);
    const end = start + needle.length;
    const suggestion = (replaceWith: string): Suggestion<SourceCodeType.LiquidHtml> => ({
      message: `Replace with ${replaceWith}`,
      fix: (corrector) => corrector.replace(start, end, replaceWith),
    });

    return {
      type: SourceCodeType.LiquidHtml,
      check: checkName,
      message: 'Parser blocking script detected',
      absolutePath: '/path/to/file.liquid',
      severity: Severity.ERROR,
      start: { ...document.positionAt(start), index: start },
      end: { ...document.positionAt(end), index: end },
      suggest: unfixable ? undefined : [suggestion('defer'), suggestion('async')],
    };
  }

  beforeEach(() => {
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager({ sendDiagnostics: vi.fn() } as any);
    documentManager.open(uri, contents, version);
    suggestionProvider = new SuggestionProvider(documentManager, diagnosticsManager);
  });

  describe('When multiple offenses of various types exist, and the selection includes an offense with at least one more of the same type in the file', () => {
    it('provides all code actions categories', async () => {
      const offenses = [
        makeOffense('UnusedAssign', '{% assign x = 1 %}'),
        makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
        makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
      ];

      diagnosticsManager.set(uri, version, offenses);

      const codeActions = suggestionProvider.codeActions({
        textDocument: { uri },
        range: {
          start: document.positionAt(contents.indexOf('2.js')),
          end: document.positionAt(contents.indexOf('2.js')),
        },
        context: { diagnostics: [] },
      });

      expect(codeActions.length).toBe(2);

      // We're targetting <script src=2.js> (index = 1 in the offense array)
      const anomalyId = 1;
      const [deferSuggestion, asyncSuggestion] = codeActions;

      expect(deferSuggestion).toEqual({
        title: `Suggestion: Replace with defer`,
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: false,
        command: {
          title: 'applySuggestion',
          command: 'themeCheck/applySuggestion',
          arguments: [uri, version, anomalyId, 0],
        },
      });

      expect(asyncSuggestion).toEqual({
        title: `Suggestion: Replace with async`,
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: false,
        command: {
          title: 'applySuggestion',
          command: 'themeCheck/applySuggestion',
          arguments: [uri, version, anomalyId, 1],
        },
      });
    });
  });

  it('does not provide code actions for offenses with no suggestions', async () => {
    const nonFixableOffense = makeOffense('ParserBlockingScript', '<script src="2.js">', true);
    diagnosticsManager.set(uri, version, [nonFixableOffense]);

    const codeActions = suggestionProvider.codeActions({
      textDocument: { uri },
      range: {
        start: document.positionAt(contents.indexOf('2.js')),
        end: document.positionAt(contents.indexOf('2.js')),
      },
      context: { diagnostics: [] },
    });

    expect(codeActions.length).toBe(0);
  });

  it('does not provide code actions if selection range does not overlap with the error', async () => {
    diagnosticsManager.set(uri, version, [
      makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
      makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
    ]);

    const codeActions = suggestionProvider.codeActions({
      textDocument: { uri },
      range: {
        start: document.positionAt(contents.indexOf('assign x = 1')),
        end: document.positionAt(contents.indexOf('= 1')),
      },
      context: { diagnostics: [] },
    });

    expect(codeActions.length).toBe(0);
  });
});
