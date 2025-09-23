import { JSONSourceCode, SourceCodeType, toSourceCode } from '@shopify/theme-check-common';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DefinitionParams, LocationLink } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AugmentedJsonSourceCode, DocumentManager } from '../../documents';
import { DefinitionProvider } from '../DefinitionProvider';

describe('Module: SchemaTranslationStringDefinitionProvider', () => {
  let provider: DefinitionProvider;
  let documentManager: DocumentManager;
  let mockGetDefaultSchemaLocaleSourceCode: (uri: string) => Promise<any>;

  beforeEach(() => {
    documentManager = new DocumentManager(
      undefined,
      undefined,
      undefined,
      async () => 'theme',
      async () => true,
    );

    const translationFileContents = JSON.stringify(
      {
        hello: {
          world: 'Hello World',
        },
      },
      null,
      2,
    );

    const uri = 'file:///locales/en.default.schema.json';
    const sourceCode = toSourceCode(uri, translationFileContents) as JSONSourceCode;
    const textDocument = TextDocument.create(uri, sourceCode.type, 1, sourceCode.source);
    mockGetDefaultSchemaLocaleSourceCode = async (): Promise<AugmentedJsonSourceCode> => {
      return {
        ...sourceCode,
        textDocument,
      };
    };

    provider = new DefinitionProvider(
      documentManager,
      async () => null,
      mockGetDefaultSchemaLocaleSourceCode,
    );
  });

  it('finds the definition of existing translation keys', async () => {
    const source = `
      {% schema %}
        {
          "name": "t:hello.world"
        }
      {% endschema %}
    `;
    documentManager.open('file:///blocks/test.liquid', source, 1);
    const params: DefinitionParams = {
      textDocument: { uri: 'file:///blocks/test.liquid' },
      position: { line: 3, character: 26 }, // Position within "t:hello.world"
    };

    const result = await provider.definitions(params);

    assert(result);
    expect(result).toHaveLength(1);
    assert(LocationLink.is(result[0]));
    expect(result[0]).toMatchObject({
      targetUri: 'file:///locales/en.default.schema.json',
      targetRange: {
        start: { line: 2, character: expect.any(Number) },
        end: { line: 2, character: expect.any(Number) },
      },
    });
  });

  it('returns null for non-existent translation key', async () => {
    const source = `
      {% schema %}
        {
          "name": "t:hello.world"
        }
      {% endschema %}
    `;
    documentManager.open('file:///blocks/products.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///blocks/products.liquid' },
      position: { line: 0, character: 7 }, // Position within "unknown.key"
    };

    const result = await provider.definitions(params);

    assert(result === null);
  });
});
