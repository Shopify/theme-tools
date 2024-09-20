import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DocumentHighlightParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { DocumentHighlightsProvider, PREVENT_DEFAULT } from '../DocumentHighlightsProvider';
import { DocumentManager } from '../../documents';

describe('Module: LiquidBlockTagDocumentHighlightsProvider', () => {
  let documentManager: DocumentManager;
  let provider: DocumentHighlightsProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    provider = new DocumentHighlightsProvider(documentManager);
  });

  it('should return document highlight ranges for liquid blocks', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4), // position within the tag name
    };

    documentManager.open(params.textDocument.uri, '{% form "cart", cart %}...{% endform %}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);
    expect(result[0]).not.to.eql(result[1]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);

    expect(startTagName).toBe('form');
    expect(endTagName).toBe('endform');
  });

  it('should return document highlight ranges for liquid conditionals', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4),
    };

    documentManager.open(
      params.textDocument.uri,
      '{% if cond %}...{% elsif cond %}...{% else %}...{% endif %}',
      1,
    );
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);
    assert(result[2]);
    assert(result[3]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);
    const branch1TagName = document.getText(result[2].range);
    const branch2TagName = document.getText(result[3].range);

    expect(startTagName).toBe('if');
    expect(endTagName).toBe('endif');
    expect(branch1TagName).toBe('elsif');
    expect(branch2TagName).toBe('else');
  });

  it('should return document highlight ranges for liquid case statements', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4),
    };

    documentManager.open(
      params.textDocument.uri,
      `{% case thing %}
         {% when 'foo' %}...
         {% when 'bar' %}...
         {% else %}...
       {% endcase %}`,
      1,
    );
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);
    assert(result[2]);
    assert(result[3]);
    assert(result[4]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);
    const branch1TagName = document.getText(result[2].range);
    const branch2TagName = document.getText(result[3].range);
    const branch3TagName = document.getText(result[4].range);

    expect(startTagName).toBe('case');
    expect(endTagName).toBe('endcase');
    expect(branch1TagName).toBe('when');
    expect(branch2TagName).toBe('when');
    expect(branch3TagName).toBe('else');
  });

  it('should return document highlight ranges for LiquidRawTags tags', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4),
    };

    documentManager.open(params.textDocument.uri, '{% raw %}...{% endraw %}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);

    expect(startTagName).toBe('raw');
    expect(endTagName).toBe('endraw');
  });

  it('should return document highlight ranges for liquid comment tags', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 4),
    };

    documentManager.open(params.textDocument.uri, '{% comment %}...{% endcomment %}', 1);
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);

    expect(startTagName).toBe('comment');
    expect(endTagName).toBe('endcomment');
  });

  it('should return the correct highlights inside liquid liquid tags', async () => {
    const params: DocumentHighlightParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(1, 10),
    };

    documentManager.open(
      params.textDocument.uri,
      `{% liquid
         if cond
           echo foo
         else
           echo bar
         endif
       %}`,
      1,
    );
    const document = documentManager.get(params.textDocument.uri)?.textDocument;
    assert(document);

    const result = await provider.documentHighlights(params);
    assert(result);
    assert(result[0]);
    assert(result[1]);
    assert(result[2]);

    const startTagName = document.getText(result[0].range);
    const endTagName = document.getText(result[1].range);
    const branch1TagName = document.getText(result[2].range);

    expect(startTagName).toBe('if');
    expect(endTagName).toBe('endif');
    expect(branch1TagName).toBe('else');
  });
});
