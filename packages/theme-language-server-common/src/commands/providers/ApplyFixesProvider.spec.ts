import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { URI } from 'vscode-uri';
import { Offense, SourceCodeType, Severity, Position } from '@shopify/theme-check-common';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { ApplyFixesProvider } from './ApplyFixesProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { offenseToDiagnostic } from '../../diagnostics/offenseToDiagnostic';

describe('Unit: ApplyFixesProvider', () => {
  const uri = URI.file('/path/to/file.liquid').toString();
  const contents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const document = TextDocument.create(uri, 'liquid', 0, contents);
  let connection: { sendDiagnostics: Mock; sendRequest: Mock };
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let applyFixProvider: ApplyFixesProvider;

  function makeOffense(
    checkName: string,
    needle: string,
    fixable: boolean = true,
  ): Offense<SourceCodeType.LiquidHtml> {
    const start = contents.indexOf(needle);
    const end = start + needle.length;

    return {
      type: SourceCodeType.LiquidHtml,
      check: checkName,
      message: 'Offense detected',
      absolutePath: '/path/to/file.liquid',
      severity: Severity.ERROR,
      start: { ...document.positionAt(start), index: start },
      end: { ...document.positionAt(end), index: end },
      fix: fixable ? (corrector) => corrector.replace(start, end, 'fixed') : undefined,
    };
  }

  beforeEach(() => {
    connection = { sendRequest: vi.fn(), sendDiagnostics: vi.fn() };
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager(connection as any);
    documentManager.open(uri, contents, 1);
    const capabilities = { hasApplyEditSupport: vi.fn().mockReturnValue(true) };
    applyFixProvider = new ApplyFixesProvider(
      documentManager,
      diagnosticsManager,
      capabilities as any,
      connection as any,
    );
  });

  describe('execute', () => {
    it('applies fixes for the given offense ids', async () => {
      const offenses = [
        makeOffense('Offense1', '{% assign x = 1 %}'),
        makeOffense('Offense2', '<script src="2.js"></script>', false),
        makeOffense('Offense3', '<script src="3.js"></script>'),
      ];

      diagnosticsManager.set(uri, 1, offenses);

      await applyFixProvider.execute(uri, 1, [0, 2]);

      expect(connection.sendRequest).toHaveBeenCalledWith(expect.anything(), {
        edit: {
          documentChanges: [
            {
              textDocument: expect.anything(),
              edits: [
                {
                  newText: 'fixed',
                  range: {
                    start: asLspPosition(offenses[0].start),
                    end: asLspPosition(offenses[0].end),
                  },
                },
                {
                  newText: 'fixed',
                  range: {
                    start: asLspPosition(offenses[2].start),
                    end: asLspPosition(offenses[2].end),
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
        diagnostics: [offenses[1]].map(offenseToDiagnostic),
      });
    });

    it('does not apply fixes if the document or diagnostics are not available', async () => {
      const offenses = [
        makeOffense('Offense1', '{% assign x = 1 %}'),
        makeOffense('Offense2', '<script src="2.js"></script>'),
        makeOffense('Offense3', '<script src="3.js"></script>'),
      ];
      diagnosticsManager.set(uri, 1, offenses);
      documentManager.close(uri);

      await applyFixProvider.execute(uri, 1, [0, 2]);

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
