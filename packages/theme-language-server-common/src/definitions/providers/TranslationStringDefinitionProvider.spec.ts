import { JSONSourceCode, SourceCodeType, toSourceCode } from '@shopify/theme-check-common';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DefinitionParams, LocationLink } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AugmentedJsonSourceCode, DocumentManager } from '../../documents';
import { DefinitionProvider } from '../DefinitionProvider';

describe('Module: TranslationStringDefinitionProvider', () => {
  let provider: DefinitionProvider;
  let documentManager: DocumentManager;
  let mockGetDefaultLocaleSourceCode: (uri: string) => Promise<any>;

  beforeEach(() => {
    documentManager = new DocumentManager();

    const translationFileContents = JSON.stringify(
      {
        hello: {
          world: 'Hello World',
        },
      },
      null,
      2,
    );

    const uri = 'file:///locales/en.default.json';
    const sourceCode = toSourceCode(uri, translationFileContents) as JSONSourceCode;
    mockGetDefaultLocaleSourceCode = async (_uri: string): Promise<AugmentedJsonSourceCode> => {
      const textDocument = TextDocument.create(uri, sourceCode.type, 1, sourceCode.source);
      return {
        ...sourceCode,
        textDocument,
      };
    };

    provider = new DefinitionProvider(documentManager, mockGetDefaultLocaleSourceCode);
  });

  it('finds the definition of existing translation keys', async () => {
    documentManager.open('file:///test.liquid', '{{ "hello.world" | t }}', 1);
    const params: DefinitionParams = {
      textDocument: { uri: 'file:///test.liquid' },
      position: { line: 0, character: 5 }, // Position within "hello.world"
    };

    const result = await provider.definitions(params);

    assert(result);
    expect(result).toHaveLength(1);
    assert(LocationLink.is(result[0]));
    expect(result[0]).toMatchObject({
      targetUri: 'file:///locales/en.default.json',
      targetRange: {
        start: { line: 2, character: expect.any(Number) },
        end: { line: 2, character: expect.any(Number) },
      },
    });
  });

  it('returns null for non-existent translation key', async () => {
    const liquidContent = '{{ "unknown.key" | t }}';
    documentManager.open('file:///templates/products.liquid', liquidContent, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///templates/products.liquid' },
      position: { line: 0, character: 7 }, // Position within "unknown.key"
    };

    const result = await provider.definitions(params);

    assert(result === null);
  });
});
