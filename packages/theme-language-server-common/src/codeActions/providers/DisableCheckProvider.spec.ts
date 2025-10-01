import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URI } from 'vscode-uri';
import { Offense, SourceCodeType, Severity, path } from '@shopify/theme-check-common';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { DisableCheckProvider } from './DisableCheckProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Unit: DisableCheckProvider', () => {
  const liquidUri = path.normalize(URI.file('/path/to/file.liquid'));
  const liquidContents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const liquidDocument = TextDocument.create(liquidUri, 'liquid', 0, liquidContents);
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let disableCheckProvider: DisableCheckProvider;

  function makeOffense(checkName: string, needle: string): Offense<SourceCodeType.LiquidHtml> {
    const start = liquidContents.indexOf(needle);
    const end = start + needle.length;

    const messages: Record<string, string> = {
      UnusedAssign: `Variable 'x' is defined but not used`,
      ParserBlockingScript: 'Parser blocking script detected',
    };

    return {
      type: SourceCodeType.LiquidHtml,
      check: checkName,
      message: messages[checkName] || 'Offense detected',
      uri: liquidUri,
      severity: Severity.ERROR,
      start: { ...liquidDocument.positionAt(start), index: start },
      end: { ...liquidDocument.positionAt(end), index: end },
    };
  }

  beforeEach(() => {
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager({ sendDiagnostics: vi.fn() } as any);
    disableCheckProvider = new DisableCheckProvider(documentManager, diagnosticsManager);
  });

  describe('Liquid files', () => {
    beforeEach(() => {
      documentManager.open(liquidUri, liquidContents, 1);
    });

    describe('When single offense exists under cursor', () => {
      beforeEach(() => {
        diagnosticsManager.set(liquidUri, 1, [makeOffense('UnusedAssign', '{% assign x = 1 %}')]);
      });

      it('provides disable actions for the offense', () => {
        const codeActions = disableCheckProvider.codeActions({
          textDocument: { uri: liquidUri },
          range: {
            start: liquidDocument.positionAt(liquidContents.indexOf('assign')),
            end: liquidDocument.positionAt(liquidContents.indexOf('assign')),
          },
          context: { diagnostics: [] },
        });

        expect(codeActions.length).toBe(2);

        const [disableNextLineAction, disableFileAction] = codeActions;

        expect(disableNextLineAction).toEqual({
          title: 'Disable UnusedAssign for this line',
          kind: 'quickfix',
          diagnostics: expect.any(Array),
          isPreferred: false,
          command: {
            title: 'Disable UnusedAssign for this line',
            command: 'themeCheck/applyDisableCheck',
            arguments: [liquidUri, 1, 'next-line', 'UnusedAssign', 1],
          },
        });

        expect(disableFileAction).toEqual({
          title: 'Disable UnusedAssign for entire file',
          kind: 'quickfix',
          diagnostics: expect.any(Array),
          isPreferred: false,
          command: {
            title: 'Disable UnusedAssign for entire file',
            command: 'themeCheck/applyDisableCheck',
            arguments: [liquidUri, 1, 'file', 'UnusedAssign', 0],
          },
        });
      });
    });

    describe('When multiple offenses of same type exist on same line', () => {
      beforeEach(() => {
        diagnosticsManager.set(liquidUri, 1, [
          makeOffense('ParserBlockingScript', '<script'),
          makeOffense('ParserBlockingScript', 'src="2.js"'),
        ]);
      });

      it('provides only one disable action per check type per line', () => {
        const codeActions = disableCheckProvider.codeActions({
          textDocument: { uri: liquidUri },
          range: {
            start: liquidDocument.positionAt(liquidContents.indexOf('<script')),
            end: liquidDocument.positionAt(
              liquidContents.indexOf('</script>') + '</script>'.length,
            ),
          },
          context: { diagnostics: [] },
        });

        expect(codeActions.length).toBe(2);

        const disableNextLineActions = codeActions.filter(
          (action) =>
            typeof action.command === 'object' && action.command?.arguments?.[2] === 'next-line',
        );
        expect(disableNextLineActions.length).toBe(1);
        expect(disableNextLineActions[0].title).toBe('Disable ParserBlockingScript for this line');
      });
    });

    describe('When multiple offenses of various types exist', () => {
      beforeEach(() => {
        diagnosticsManager.set(liquidUri, 1, [
          makeOffense('UnusedAssign', '{% assign x = 1 %}'),
          makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
          makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
        ]);
      });

      it('provides disable actions for each unique check under cursor', () => {
        const codeActions = disableCheckProvider.codeActions({
          textDocument: { uri: liquidUri },
          range: {
            start: liquidDocument.positionAt(0),
            end: liquidDocument.positionAt(liquidContents.length),
          },
          context: { diagnostics: [] },
        });

        // Should have 2 checks × 2 action types = 4 actions
        // But duplicates on same line are filtered
        const uniqueActions = new Set(
          codeActions
            .map((a) => {
              if (typeof a.command === 'object' && a.command?.arguments) {
                return `${a.command.arguments[3]}-${a.command.arguments[2]}`;
              }
              return '';
            })
            .filter(Boolean),
        );

        expect(uniqueActions.has('UnusedAssign-next-line')).toBe(true);
        expect(uniqueActions.has('UnusedAssign-file')).toBe(true);
        expect(uniqueActions.has('ParserBlockingScript-next-line')).toBe(true);
        expect(uniqueActions.has('ParserBlockingScript-file')).toBe(true);
      });
    });

    describe('When cursor is not on any offense', () => {
      beforeEach(() => {
        diagnosticsManager.set(liquidUri, 1, [makeOffense('UnusedAssign', '{% assign x = 1 %}')]);
      });

      it('provides no code actions', () => {
        const codeActions = disableCheckProvider.codeActions({
          textDocument: { uri: liquidUri },
          range: {
            start: liquidDocument.positionAt(liquidContents.length - 1),
            end: liquidDocument.positionAt(liquidContents.length),
          },
          context: { diagnostics: [] },
        });

        expect(codeActions).toEqual([]);
      });
    });

    describe('When inside stylesheet or javascript tags', () => {
      it('provides no code actions inside stylesheet tags', () => {
        const stylesheetContents = `
          {% stylesheet %}
            @starting-style { 
              opacity: 0; 
            }
          {% endstylesheet %}
        `;
        const stylesheetDocument = TextDocument.create(liquidUri, 'liquid', 1, stylesheetContents);
        documentManager.open(liquidUri, stylesheetContents, 1);

        // Create a CSS-related offense inside the stylesheet tag
        const errorText = '@starting-style';
        const errorStart = stylesheetContents.indexOf(errorText);
        const errorEnd = errorStart + errorText.length;

        diagnosticsManager.set(liquidUri, 1, [
          {
            type: SourceCodeType.LiquidHtml,
            check: 'CSSCheck',
            message: 'Unknown at rule @starting-style',
            uri: liquidUri,
            severity: Severity.ERROR,
            start: { ...stylesheetDocument.positionAt(errorStart), index: errorStart },
            end: { ...stylesheetDocument.positionAt(errorEnd), index: errorEnd },
          },
        ]);

        const codeActions = disableCheckProvider.codeActions({
          textDocument: { uri: liquidUri },
          range: {
            start: stylesheetDocument.positionAt(errorStart),
            end: stylesheetDocument.positionAt(errorEnd),
          },
          context: { diagnostics: [] },
        });

        expect(codeActions).toEqual([]);
      });

      it('provides no code actions inside javascript tags', () => {
        const javascriptContents = `
          {% javascript %}
            console.log('error');
            const x = await fetch('/api');
          {% endjavascript %}
        `;
        const javascriptDocument = TextDocument.create(liquidUri, 'liquid', 1, javascriptContents);
        documentManager.open(liquidUri, javascriptContents, 1);

        // Create a JavaScript-related offense inside the javascript tag
        const errorText = 'await';
        const errorStart = javascriptContents.indexOf(errorText);
        const errorEnd = errorStart + errorText.length;

        diagnosticsManager.set(liquidUri, 1, [
          {
            type: SourceCodeType.LiquidHtml,
            check: 'JSCheck',
            message: 'await is only valid in async functions',
            uri: liquidUri,
            severity: Severity.ERROR,
            start: { ...javascriptDocument.positionAt(errorStart), index: errorStart },
            end: { ...javascriptDocument.positionAt(errorEnd), index: errorEnd },
          },
        ]);

        const codeActions = disableCheckProvider.codeActions({
          textDocument: { uri: liquidUri },
          range: {
            start: javascriptDocument.positionAt(errorStart),
            end: javascriptDocument.positionAt(errorEnd),
          },
          context: { diagnostics: [] },
        });

        expect(codeActions).toEqual([]);
      });
    });
  });
});
