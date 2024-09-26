import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../../documents';
import { OnTypeFormattingProvider } from '../OnTypeFormattingProvider';

const options: DocumentOnTypeFormattingParams['options'] = {
  insertSpaces: true,
  tabSize: 2,
};

describe('Module: HtmlElementAutoclosingOnTypeFormattingProvider', () => {
  let documentManager: DocumentManager;
  let onTypeFormattingProvider: OnTypeFormattingProvider;
  let setCursorPositionSpy: ReturnType<typeof vi.fn>;
  const uri = 'file:///path/to/document.liquid';

  beforeEach(() => {
    setCursorPositionSpy = vi.fn();
    documentManager = new DocumentManager();
    onTypeFormattingProvider = new OnTypeFormattingProvider(documentManager, setCursorPositionSpy);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a TextEdit to insert a closing <tag> when you type > for an unclosed tag', async () => {
    const source = '<div id="main">';
    documentManager.open(uri, source, 1);
    const document = documentManager.get(uri)?.textDocument!;

    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri },
      position: document.positionAt(source.indexOf('>') + 1),
      ch: '>',
      options,
    };

    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal('<div id="main"></div>');

    vi.advanceTimersByTime(10);
    expect(setCursorPositionSpy).toHaveBeenCalledWith(
      document,
      document.positionAt(source.indexOf('>') + 1),
    );
  });

  it('should return a TextEdit to insert a closing <tag> when you type > for an unclosed tag even if the unclosed tag is higher up', async () => {
    const CURSOR = '█';
    // in this scenario, the cursor is after div#inner, but the unclosed tag is div#main.
    // we still want to close it because that's probably what you want to do.
    const source = `
      <div id="main">
        <img>
        <div id="inner">█
      </div>
    `;
    documentManager.open(uri, source.replace(CURSOR, ''), 1);
    const document = documentManager.get(uri)?.textDocument!;

    const indexOfCursor = source.indexOf(CURSOR);
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri },
      position: document.positionAt(indexOfCursor),
      ch: '>',
      options,
    };

    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal(`
      <div id="main">
        <img>
        <div id="inner"></div>
      </div>
    `);

    vi.advanceTimersByTime(10);
    expect(setCursorPositionSpy).toHaveBeenCalledWith(document, document.positionAt(indexOfCursor));
  });

  it('should return a TextEdit to insert a closing <tag> when you type > for an unclosed tag even if the unclosed tag is higher up and theres a sibling closed tag', async () => {
    const CURSOR = '█';
    // in this scenario, the cursor is after div#inner, but the unclosed tag is div#main.
    // we still want to close it because that's probably what you want to do.
    const source = `
      <div id="main">
        <div id="inner">█
        <div></div>
      </div>
    `;
    documentManager.open(uri, source.replace(CURSOR, ''), 1);
    const document = documentManager.get(uri)?.textDocument!;

    const indexOfCursor = source.indexOf(CURSOR);
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri },
      position: document.positionAt(indexOfCursor),
      ch: '>',
      options,
    };

    assert(document);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    assert(result);
    expect(TextDocument.applyEdits(document, result)).to.equal(`
      <div id="main">
        <div id="inner"></div>
        <div></div>
      </div>
    `);

    vi.advanceTimersByTime(10);
    expect(setCursorPositionSpy).toHaveBeenCalledWith(document, document.positionAt(indexOfCursor));
  });

  it('should try to close dangling html open tags inside liquid branches', async () => {
    const CURSOR = '█';
    const scenarios = [
      '{% if cond %}<div>█{% endif %}',
      '{% if cond %}{% else %}<div>█{% endif %}',
      '{% unless cond %}<div>█{% endunless %}',
      '{% case thing %}{% when thing %}<div>█{% endif %}',
    ];
    for (const source of scenarios) {
      documentManager.open(uri, source.replace(CURSOR, ''), 1);
      const document = documentManager.get(uri)?.textDocument!;
      const indexOfCursor = source.indexOf(CURSOR);
      const params: DocumentOnTypeFormattingParams = {
        textDocument: { uri },
        position: document.positionAt(indexOfCursor),
        ch: '>',
        options,
      };
      assert(document);
      const result = await onTypeFormattingProvider.onTypeFormatting(params);
      assert(result);
      expect(TextDocument.applyEdits(document, result)).to.equal(source.replace(CURSOR, '</div>'));

      vi.advanceTimersByTime(10);
      expect(setCursorPositionSpy).toHaveBeenCalledWith(
        document,
        document.positionAt(indexOfCursor),
      );
    }
  });

  it('should not try to close the tag when pressing > inside a Liquid tag if condition (what HTML would do)', async () => {
    const CURSOR = '█';
    const scenarios = ['<div {% if cond >█', '<div {% if cond >█ %}>', '<div {% if cond >█ 2 %}>'];
    for (const source of scenarios) {
      documentManager.open(uri, source.replace(CURSOR, ''), 1);
      const document = documentManager.get(uri)?.textDocument!;

      const indexOfCursor = source.indexOf(CURSOR);
      const params: DocumentOnTypeFormattingParams = {
        textDocument: { uri },
        position: document.positionAt(indexOfCursor),
        ch: '>',
        options,
      };

      assert(document);

      const result = await onTypeFormattingProvider.onTypeFormatting(params);
      assert(!result);
    }
  });
});
