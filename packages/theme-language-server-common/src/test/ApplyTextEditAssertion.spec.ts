import { describe, expect, it } from 'vitest';
import { Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Module: ApplyTextEditAssertion', () => {
  it('should do normal matching as expected', () => {
    const source = 'hello world';
    const doc = TextDocument.create('file:///file.liquid', 'liquid', 1, source);
    const indexOfWorld = source.indexOf('world');
    const textEdit = TextEdit.replace(
      Range.create(doc.positionAt(indexOfWorld), doc.positionAt(indexOfWorld + 5)),
      'planet',
    );
    expect(textEdit).to.applyTextEdit(source, 'hello planet');
    expect(textEdit).not.to.applyTextEdit('super world', 'hello planet');
  });

  it('should also support asymetric matching', () => {
    const source = 'hello world';
    const doc = TextDocument.create('file:///file.liquid', 'liquid', 1, source);
    const indexOfWorld = source.indexOf('world');
    const textEdit = TextEdit.replace(
      Range.create(doc.positionAt(indexOfWorld), doc.positionAt(indexOfWorld + 5)),
      'planet',
    );

    const actual = { label: 'foo', textEdit };
    expect(actual).toEqual(
      expect.objectContaining({
        textEdit: expect.applyTextEdit(source, 'hello planet'),
      }),
    );

    expect(actual).not.toEqual(
      expect.objectContaining({
        textEdit: expect.applyTextEdit('super world', 'hello planet'),
      }),
    );
  });
});
