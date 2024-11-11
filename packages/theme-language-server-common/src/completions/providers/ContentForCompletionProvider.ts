import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind, TextEdit } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

export class ContentForCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.String ||
      parentNode.type !== NodeTypes.ContentForMarkup
    ) {
      return [];
    }

    const options = {
      block: 'Renders a static theme block within `sections` or `theme blocks`.\n',
      blocks: `Renders block elements within sections or other blocks as configured in the JSON template or section groups. 
See [theme blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks) 
to see how to create theme blocks that can be used this way.\n`,
    };
    const partial = node.value;

    return Object.entries(options)
      .filter(([keyword, _description]) => keyword.startsWith(partial))
      .map(
        ([keyword, description]): CompletionItem => ({
          label: keyword,
          kind: CompletionItemKind.Keyword,
          documentation: {
            kind: 'markdown',
            value: description,
          },
        }),
      );
  }
}
