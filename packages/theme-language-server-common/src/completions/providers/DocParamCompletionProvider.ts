import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider } from './common';

export class DocParamCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    // We only want to provide completions inside doc tags
    if (!node || !parentNode || node.type !== NodeTypes.TextNode) {
      return [];
    }

    const text = node.value;
    const partial = text.replace(CURSOR, '').trim();

    // Only trigger completion if we're typing something that could be @param
    if (!partial.startsWith('@') && !partial.startsWith('@p')) {
      return [];
    }

    const returnValue: CompletionItem = {
      label: '@param',
      kind: CompletionItemKind.Keyword,
      insertTextFormat: InsertTextFormat.Snippet,
      insertText: '@param ${1:paramName}${2: - ${3:description}}',
      documentation: {
        kind: 'markdown',
        value: 'Defines a parameter for the documented section',
      },
    };

    return [returnValue];
  }
}
