import { describe, expect, test } from 'vitest';
import { CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import { createLiquidCompletionParams } from '../params';
import { DocParamCompletionProvider } from './DocParamCompletionProvider';
import { createMockDocument } from '../../test/test-helpers';

describe('Unit: DocParamCompletionProvider', () => {
  const provider = new DocParamCompletionProvider();

  test('should provide @param completion inside doc tags', async () => {
    const doc = createMockDocument('{% doc %}\n  @p|\n{% enddoc %}');
    const params = createLiquidCompletionParams(doc, {
      textDocument: doc.textDocument,
      position: doc.textDocument.positionAt(13), // After @p
    });

    const completions = await provider.completions(params);

    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      label: '@param',
      kind: CompletionItemKind.Keyword,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: '@param ${1:paramName}${2: - ${3:description}}',
      documentation: {
        kind: 'markdown',
        value: 'Defines a parameter for the documented section',
      },
    });
  });

  test('should not provide completion outside doc tags', async () => {
    const doc = createMockDocument('{% if true %}\n  @p|\n{% endif %}');
    const params = createLiquidCompletionParams(doc, {
      textDocument: doc.textDocument,
      position: doc.textDocument.positionAt(16),
    });

    const completions = await provider.completions(params);
    expect(completions).toHaveLength(0);
  });

  test('should not provide completion for non-matching text', async () => {
    const doc = createMockDocument('{% doc %}\n  something|\n{% enddoc %}');
    const params = createLiquidCompletionParams(doc, {
      textDocument: doc.textDocument,
      position: doc.textDocument.positionAt(18),
    });

    const completions = await provider.completions(params);
    expect(completions).toHaveLength(0);
  });
});
