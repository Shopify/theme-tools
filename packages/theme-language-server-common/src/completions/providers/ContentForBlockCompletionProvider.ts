import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

export class ContentForBlockCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.String ||
      parentNode.type !== NodeTypes.ContentForMarkup) {
      return [];
    }

    const options = ['block', 'blocks'];
    const partial = node.value;

    return options
      .filter((keyword) => keyword.startsWith(partial))
      .map(
        (keyword: string): CompletionItem => ({
          label: keyword,
          kind: CompletionItemKind.Keyword,
          documentation: {
            kind: 'markdown',
            value: `content_for ${keyword}`,
          },
        }),
      );
  }
}