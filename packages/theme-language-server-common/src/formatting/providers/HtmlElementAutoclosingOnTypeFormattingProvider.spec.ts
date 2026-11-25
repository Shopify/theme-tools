import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { OnTypeFormattingProvider } from '../OnTypeFormattingProvider';
import type { SetCursorPosition } from '../types';

const options: DocumentOnTypeFormattingParams['options'] = {
  insertSpaces: true,
  tabSize: 2,
};

describe('Module: HtmlElementAutoclosingOnTypeFormattingProvider', () => {
  let documentManager: DocumentManager;
  let onTypeFormattingProvider: OnTypeFormattingProvider;
  let setCursorPositionSpy: ReturnType<typeof vi.fn<SetCursorPosition>>;
  const uri = 'file:///path/to/document.liquid';

  beforeEach(() => {
    setCursorPositionSpy = vi.fn<SetCursorPosition>();
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
    expect(result).to.applyEdits(document, '<div id="main"></div>');

    vi.advanceTimersByTime(10);
    expect(setCursorPositionSpy).toHaveBeenCalledWith(
      document,
      document.positionAt(source.indexOf('>') + 1),
    );
  });

  it('should close the newly opened child before an existing parent closing tag', async () => {
    const CURSOR = '█';
    const source = `<ul>\n  <li>${CURSOR}\n</ul>`;
    const expected = `<ul>\n  <li></li>${CURSOR}\n</ul>`;
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
    expect(result).to.applyEdits(document, expected.replace(CURSOR, ''));
  });

  it('should close the newly opened element, not its parent, when the parent is already closed', async () => {
    const CURSOR = '█';
    const scenarios: [source: string, closingTag: string][] = [
      ['<div>\n  <span class="a">█\n</div>', '</span>'],
      ['<ul>\n  <li>a</li>\n  <li>█\n</ul>', '</li>'],
      ['<ul>\n  <li>█\n  <li>b</li>\n</ul>', '</li>'],
      ['<div><ul>\n  <li>█\n</ul></div>', '</li>'],
      ['<ul>\n  <li\n    id="a"\n    class="b"\n  >█\n</ul>', '</li>'],
      ['<ul>\n  <li class="{{ a }}">█\n</ul>', '</li>'],
      ['<ul>\n  <li {% if a %}class="b"{% endif %}>█\n</ul>', '</li>'],
      ['<div>\n  <h{{ level }}>█\n</div>', '</h{{ level }}>'],
      ['{% if a %}\n<ul>\n  <li>█\n</ul>\n{% endif %}', '</li>'],
      ['<ul>\n  {% for item in items %}\n    <li>█\n  {% endfor %}\n</ul>', '</li>'],
    ];
    for (const [source, closingTag] of scenarios) {
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
      assert(result, 'expected results for source:\n' + source);
      expect(result).to.applyEdits(document, source.replace(CURSOR, closingTag));

      vi.advanceTimersByTime(10);
      expect(setCursorPositionSpy).toHaveBeenCalledWith(
        document,
        document.positionAt(indexOfCursor),
      );
    }
  });

  it('should close an unclosed <script> or <style>', async () => {
    const CURSOR = '█';
    const scenarios: [source: string, closingTag: string][] = [
      ['<script>█', '</script>'],
      ['<style>█', '</style>'],
      ['<div>\n  <script type="module">█\n</div>', '</script>'],
    ];
    for (const [source, closingTag] of scenarios) {
      documentManager.open(uri, source.replace(CURSOR, ''), 1);
      const document = documentManager.get(uri)?.textDocument!;
      const params: DocumentOnTypeFormattingParams = {
        textDocument: { uri },
        position: document.positionAt(source.indexOf(CURSOR)),
        ch: '>',
        options,
      };
      assert(document);
      const result = await onTypeFormattingProvider.onTypeFormatting(params);
      assert(result, 'expected results for source:\n' + source);
      expect(result).to.applyEdits(document, source.replace(CURSOR, closingTag));
    }
  });

  it('should not insert a closing tag when the element at the cursor needs none', async () => {
    const CURSOR = '█';
    const scenarios = [
      // void element inside a closed parent
      '<div>\n  <img src="a.png">█\n</div>',
      // retyping > on an element that is already closed
      '<ul>█\n  <li></li>\n</ul>',
      '<ul>\n  <li>█</li>\n</ul>',
    ];
    for (const source of scenarios) {
      documentManager.open(uri, source.replace(CURSOR, ''), 1);
      const document = documentManager.get(uri)?.textDocument!;
      const params: DocumentOnTypeFormattingParams = {
        textDocument: { uri },
        position: document.positionAt(source.indexOf(CURSOR)),
        ch: '>',
        options,
      };
      assert(document);
      const result = await onTypeFormattingProvider.onTypeFormatting(params);
      assert(!result, 'expected no results for source:\n' + source);
    }
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
    const expected = `
      <div id="main">
        <img>
        <div id="inner"></div>
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
    expect(result).to.applyEdits(document, expected);

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
    const expected = `
      <div id="main">
        <div id="inner"></div>
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
    expect(result).to.applyEdits(document, expected);

    vi.advanceTimersByTime(10);
    expect(setCursorPositionSpy).toHaveBeenCalledWith(document, document.positionAt(indexOfCursor));
  });

  it('should try to close dangling html open tags inside liquid branches', async () => {
    const CURSOR = '█';
    const scenarios = [
      '{% if cond %}<div>█{% endif %}',
      '{% if cond %}{% else %}<div>█{% endif %}',
      '{% if cond %}<div></div>{% else %}<div>█{% endif %}',
      '{% if cond %}<div></div>{% elsif cond %}<div>█{% else %}<div>{% endif %}',
      '{% if cond %}<div></div>{% elsif cond %}<div>█ {% else %}<div>{% endif %}',
      '{% unless cond %}<div>█{% endunless %}',
      '{% unless cond %}<div><div>█{% endunless %}',
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
      assert(result, 'expected results for source:\n' + source);
      expect(result).to.applyEdits(document, source.replace(CURSOR, '</div>'));

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
