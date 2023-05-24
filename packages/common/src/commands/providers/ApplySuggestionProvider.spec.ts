import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { URI } from 'vscode-uri';
import {
  Offense,
  SourceCodeType,
  Severity,
  Position,
  Suggestion,
} from '@shopify/theme-check-common';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { ApplySuggestionProvider } from './ApplySuggestionProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { offenseToDiagnostic } from '../../diagnostics/offenseToDiagnostic';

describe('Unit: ApplySuggestionProvider', () => {
  const uri = URI.file('/path/to/file.liquid').toString();
  const contents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const version = 0;
  const document = TextDocument.create(uri, 'liquid', version, contents);
  let connection: { sendDiagnostics: Mock; sendRequest: Mock };
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let applySuggestionProvider: ApplySuggestionProvider;

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
    connection = { sendRequest: vi.fn(), sendDiagnostics: vi.fn() };
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager(connection as any);
    documentManager.open(uri, contents, version);
    const capabilities = { hasApplyEditSupport: vi.fn().mockReturnValue(true) };
    applySuggestionProvider = new ApplySuggestionProvider(
      documentManager,
      diagnosticsManager,
      capabilities as any,
      connection as any,
    );
  });

  describe('execute', () => {
    it('applies the suggestion for the given offense id and suggestion index', async () => {
      const offenses = [
        makeOffense('Offense1', '{% assign x = 1 %}'),
        makeOffense('Offense2', '<script src="2.js"></script>'),
        makeOffense('Offense3', '<script src="3.js"></script>'),
      ];

      diagnosticsManager.set(uri, version, offenses);

      const offenseId = 1; // 2.js
      const suggestionIndex = 1; // async
      await applySuggestionProvider.execute(uri, version, offenseId, suggestionIndex);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        label: 'Apply suggestion: Replace with async',
        edit: {
          documentChanges: [
            {
              textDocument: expect.anything(),
              edits: [
                {
                  newText: 'async',
                  range: {
                    start: asLspPosition(offenses[1].start),
                    end: asLspPosition(offenses[1].end),
                  },
                },
              ],
            },
          ],
        },
      });

      // We clean up stale diagnostics when we're done
      expect(connection.sendDiagnostics).toHaveBeenCalledWith({
        uri: expect.anything(),
        version: expect.any(Number),
        diagnostics: offenses.filter((_, index) => index !== offenseId).map(offenseToDiagnostic),
      });
    });

    it('does not apply fixes if the document or diagnostics are not available', async () => {
      const offenses = [
        makeOffense('Offense1', '{% assign x = 1 %}'),
        makeOffense('Offense2', '<script src="2.js"></script>'),
        makeOffense('Offense3', '<script src="3.js"></script>'),
      ];
      diagnosticsManager.set(uri, 0, offenses);
      documentManager.close(uri);

      await applySuggestionProvider.execute(uri, 1, 0, 0);

      expect(connection.sendRequest).not.toHaveBeenCalled();
    });
  });
});

function omit(obj: any, key: string) {
  const clone = { ...obj };
  delete clone[key];
  return clone;
}

function asLspPosition(position: Position): any {
  return omit(position, 'index');
}
