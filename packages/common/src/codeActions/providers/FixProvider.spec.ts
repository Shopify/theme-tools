import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URI } from 'vscode-uri';
import { Offense, SourceCodeType, Severity } from '@shopify/theme-check-common';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { FixProvider } from './FixProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Unit: FixProvider', () => {
  const uri = URI.file('/path/to/file.liquid').toString();
  const contents = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const document = TextDocument.create(uri, 'liquid', 0, contents);
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let fixProvider: FixProvider;

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
    documentManager.open(uri, contents, 1);
    fixProvider = new FixProvider(documentManager, diagnosticsManager);
  });

  describe('When multiple offenses of various types exist, and the selection includes an offense with at least one more of the same type in the file', () => {
    beforeEach(() => {
      diagnosticsManager.set(uri, 1, [
        makeOffense('UnusedAssign', '{% assign x = 1 %}'),
        makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
        makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
      ]);
    });

    it('provides all code actions categories', async () => {
      const codeActions = fixProvider.codeActions({
        textDocument: { uri },
        range: {
          start: document.positionAt(contents.indexOf('2.js')),
          end: document.positionAt(contents.indexOf('2.js')),
        },
        context: { diagnostics: [] },
      });

      expect(codeActions.length).toBe(3);

      const [fixCursorAction, fixSameTypeAction, fixAllAction] = codeActions;

      expect(fixCursorAction).toEqual({
        title: 'Fix this ParserBlockingScript problem: Parser blocking script detected',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: true,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [1]],
        },
      });

      expect(fixSameTypeAction).toEqual({
        title: 'Fix all ParserBlockingScript problems',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: false,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [1, 2]],
        },
      });

      expect(fixAllAction).toEqual({
        title: 'Fix all auto-fixable problems',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: false,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [0, 1, 2]],
        },
      });
    });
  });

  describe('When multiple offenses of various types exist, and the selection includes an offense without more of the same type in the file', () => {
    beforeEach(() => {
      diagnosticsManager.set(uri, 1, [
        makeOffense('UnusedAssign', '{% assign x = 1 %}'),
        makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
      ]);
    });

    it('provides code actions, and the fix all same type is omitted', async () => {
      const codeActions = fixProvider.codeActions({
        textDocument: { uri },
        range: {
          start: document.positionAt(contents.indexOf('2.js')),
          end: document.positionAt(contents.indexOf('2.js')),
        },
        context: { diagnostics: [] },
      });

      expect(codeActions.length).toBe(2);

      const [fixCursorAction, fixAllAction] = codeActions;

      expect(fixCursorAction).toEqual({
        title: 'Fix this ParserBlockingScript problem: Parser blocking script detected',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: true,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [1]],
        },
      });

      expect(fixAllAction).toEqual({
        title: 'Fix all auto-fixable problems',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: false,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [0, 1]],
        },
      });
    });
  });

  describe('When only one offense type exists, and the selection includes an offense', () => {
    beforeEach(() => {
      diagnosticsManager.set(uri, 1, [
        makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
        makeOffense('ParserBlockingScript', '<script src="3.js"></script>'),
      ]);
    });

    it('provides code actions, and the fix all code action is omitted', async () => {
      const codeActions = fixProvider.codeActions({
        textDocument: { uri },
        range: {
          start: document.positionAt(contents.indexOf('2.js')),
          end: document.positionAt(contents.indexOf('2.js')),
        },
        context: { diagnostics: [] },
      });

      expect(codeActions.length).toBe(2);

      const [fixCursorAction, fixSameTypeAction] = codeActions;

      expect(fixCursorAction).toEqual({
        title: 'Fix this ParserBlockingScript problem: Parser blocking script detected',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: true,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [0]],
        },
      });

      expect(fixSameTypeAction).toEqual({
        title: 'Fix all ParserBlockingScript problems',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: false,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [0, 1]],
        },
      });
    });
  });

  describe('When there is only one offense', () => {
    beforeEach(() => {
      diagnosticsManager.set(uri, 1, [
        makeOffense('ParserBlockingScript', '<script src="2.js"></script>'),
      ]);
    });

    it('provides a code action to fix it', async () => {
      const codeActions = fixProvider.codeActions({
        textDocument: { uri },
        range: {
          start: document.positionAt(contents.indexOf('2.js')),
          end: document.positionAt(contents.indexOf('2.js')),
        },
        context: { diagnostics: [] },
      });

      expect(codeActions.length).toBe(1);

      const [fixCursorAction] = codeActions;

      expect(fixCursorAction).toEqual({
        title: 'Fix this ParserBlockingScript problem: Parser blocking script detected',
        kind: 'quickfix',
        diagnostics: expect.any(Array),
        isPreferred: true,
        command: {
          title: 'applyFixes',
          command: 'themeCheck/applyFixes',
          arguments: [uri, 1, [0]],
        },
      });
    });
  });

  it('provides code actions for a set of fixable offenses', async () => {
    diagnosticsManager.set(uri, 1, [
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

    expect(codeActions.length).toBe(3);

    const [fixCursorAction, fixSameTypeAction, fixAllAction] = codeActions;

    expect(fixCursorAction).toEqual({
      title: 'Fix this ParserBlockingScript problem: Parser blocking script detected',
      kind: 'quickfix',
      diagnostics: expect.any(Array),
      isPreferred: true,
      command: {
        title: 'applyFixes',
        command: 'themeCheck/applyFixes',
        arguments: [uri, 1, [1]],
      },
    });

    expect(fixSameTypeAction).toEqual({
      title: 'Fix all ParserBlockingScript problems',
      kind: 'quickfix',
      diagnostics: expect.any(Array),
      isPreferred: false,
      command: {
        title: 'applyFixes',
        command: 'themeCheck/applyFixes',
        arguments: [uri, 1, [1, 2]],
      },
    });

    expect(fixAllAction).toEqual({
      title: 'Fix all auto-fixable problems',
      kind: 'quickfix',
      diagnostics: expect.any(Array),
      isPreferred: false,
      command: {
        title: 'applyFixes',
        command: 'themeCheck/applyFixes',
        arguments: [uri, 1, [0, 1, 2]],
      },
    });
  });

  it('does not provide code actions for non-fixable offenses', async () => {
    const nonFixableOffense = makeOffense('ParserBlockingScript', '<script src="2.js">', true);
    diagnosticsManager.set(uri, 1, [nonFixableOffense]);

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

  it('does not provide code actions if selection range does not overlap with the error', async () => {
    diagnosticsManager.set(uri, 1, [
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

    expect(codeActions.length).toBe(0);
  });
});
