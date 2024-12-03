import { describe, expect, it } from 'vitest';
import { Range, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('Module: ApplyTextEditAssertion', () => {
  const source = 'hello world';
  const textDocument = TextDocument.create('file:///file.liquid', 'liquid', 1, source);
  const indexOfHello = source.indexOf('hello');
  const helloToHiEdit = TextEdit.replace(
    Range.create(
      textDocument.positionAt(indexOfHello),
      textDocument.positionAt(indexOfHello + 'hello'.length),
    ),
    'hi',
  );
  const indexOfWorld = source.indexOf('world');
  const worldToPlanetEdit = TextEdit.replace(
    Range.create(
      textDocument.positionAt(indexOfWorld),
      textDocument.positionAt(indexOfWorld + 'world'.length),
    ),
    'planet',
  );

  it('should do normal matching as expected', () => {
    expect(worldToPlanetEdit).to.applyEdits(source, 'hello planet');
    expect(worldToPlanetEdit).not.to.applyEdits('super world', 'hello planet');
  });

  it('should accept arrays of text edits', () => {
    expect([helloToHiEdit, worldToPlanetEdit]).to.applyEdits(source, 'hi planet');
    expect([helloToHiEdit, worldToPlanetEdit]).not.to.applyEdits(source, 'something else entirely');
  });

  it('should strip the █ character from source strings', () => {
    expect(helloToHiEdit).to.applyEdits('hello █world', 'hi world');
  });

  it('should accept text document objects as source replacements', () => {
    expect(helloToHiEdit).to.applyEdits(textDocument, 'hi world');
  });

  it('should support asymmetric matching', () => {
    const actual = { label: 'foo', textEdit: worldToPlanetEdit };
    expect(actual).toEqual(
      expect.objectContaining({
        textEdit: expect.applyEdits(source, 'hello planet'),
      }),
    );

    expect(actual).not.toEqual(
      expect.objectContaining({
        textEdit: expect.applyEdits('super world', 'hello planet'),
      }),
    );
  });
});
