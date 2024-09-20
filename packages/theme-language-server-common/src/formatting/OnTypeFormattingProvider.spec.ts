import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../documents';
import { OnTypeFormattingProvider } from './OnTypeFormattingProvider';

const options: DocumentOnTypeFormattingParams['options'] = {
  insertSpaces: true,
  tabSize: 2,
};

describe('Module: OnTypeFormattingProvider', () => {
  let documentManager: DocumentManager;
  let onTypeFormattingProvider: OnTypeFormattingProvider;

  beforeEach(() => {
    documentManager = new DocumentManager();
    onTypeFormattingProvider = new OnTypeFormattingProvider(documentManager);
  });

  it('should return null for non-existent documents', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/non-existent-document.liquid' },
      position: Position.create(0, 0),
      ch: ' ',
      options,
    };

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });

  it('should return null if character is space and cursor position is less than or equal to 2', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 1),
      ch: ' ',
      options,
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });

  it('should return null if character is not space and cursor position is less than or equal to 1', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 0),
      ch: 'a',
      options,
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });

  it('should return null for characters not matching any case', async () => {
    const params: DocumentOnTypeFormattingParams = {
      textDocument: { uri: 'file:///path/to/document.liquid' },
      position: Position.create(0, 3),
      ch: 'a',
      options,
    };

    documentManager.open(params.textDocument.uri, 'Sample text content', 1);

    const result = await onTypeFormattingProvider.onTypeFormatting(params);
    expect(result).toBeNull();
  });
});
