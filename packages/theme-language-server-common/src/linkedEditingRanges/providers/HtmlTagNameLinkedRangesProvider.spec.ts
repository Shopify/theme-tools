import { describe, beforeEach, it, expect, assert } from 'vitest';
import { LinkedEditingRangesProvider } from '../LinkedEditingRangesProvider';
import { DocumentManager } from '../../documents';
import { LinkedEditingRangeParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { htmlElementNameWordPattern } from '../wordPattern';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Module: HtmlTagNameLinkedRangesProvider', () => {
  const uri = 'file:///path/to/document.liquid';
  let documentManager: DocumentManager;
  let provider: LinkedEditingRangesProvider;
  let params: LinkedEditingRangeParams;
  let document: TextDocument;
  let source: string;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new LinkedEditingRangesProvider(documentManager);
  });

  describe('When the HTML tag is closed and the cursor is inside the tag name', () => {
    beforeEach(() => {
      source = '<div id="main"><img><div></div></div>';
      documentManager.open(uri, source, 1);
      document = documentManager.get(uri)?.textDocument!;
    });

    it('should return linked editing ranges for HTML tag names', async () => {
      params = {
        textDocument: { uri },
        position: document.positionAt(2), // position within the opening div#main tag name
      };

      const result = await provider.linkedEditingRanges(params);
      assert(result);
      assert(result.ranges[0]);
      assert(result.ranges[1]);
      expect(result.ranges[0]).not.to.eql(result.ranges[1]);

      const startTagName = document.getText(result.ranges[0]);
      const endTagName = document.getText(result.ranges[1]);

      expect(startTagName).toBe('div');
      expect(endTagName).toBe('div');
      expect(result.wordPattern).toBe(htmlElementNameWordPattern);
    });

    it('should return linked editing ranges for closing HTML tag names', async () => {
      params = {
        textDocument: { uri },
        position: document.positionAt(source.indexOf('</div>') + 2), // position within the closing div tag name
      };

      const result = await provider.linkedEditingRanges(params);
      assert(result);
      assert(result.ranges[0]);
      assert(result.ranges[1]);

      const startTagName = document.getText(result.ranges[0]);
      const endTagName = document.getText(result.ranges[1]);

      expect(startTagName).toBe('div');
      expect(endTagName).toBe('div');
      expect(result.wordPattern).toBe(htmlElementNameWordPattern);
    });
  });

  describe('When The HTML tag name is dangling', () => {
    beforeEach(() => {
      // This is acceptable Liquid. We allow folks to have an unclosed HTML
      // element inside conditional blocks.
      source = `
        {% if cond %}
          <div>
        {% endif %}
      `;
      documentManager.open(uri, source, 1);
      document = documentManager.get(uri)?.textDocument!;
    });

    it('should not return linked editing ranges', async () => {
      params = {
        textDocument: { uri },
        position: document.positionAt(source.indexOf('<div>') + 1),
      };
      const result = await provider.linkedEditingRanges(params);
      expect(result).toBeNull();
    });
  });

  it('should return null for positions not within HTML tag names', async () => {
    documentManager.open(uri, '<div></div>', 1);
    params = {
      textDocument: { uri },
      position: Position.create(0, 0), // position outside the tag name
    };

    const result = await provider.linkedEditingRanges(params);
    expect(result).toBeNull();
  });
});
