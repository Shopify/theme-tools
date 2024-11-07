import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

export type GetSnippetNamesForURI = (uri: string) => Promise<string[]>;

export class RenderSnippetCompletionProvider implements Provider {
  constructor(private readonly getSnippetNamesForURI: GetSnippetNamesForURI = async () => []) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.String ||
      parentNode.type !== NodeTypes.RenderMarkup
    ) {
      return [];
    }

    const options = await this.getSnippetNamesForURI(params.textDocument.uri);
    const partial = node.value;

    return options
      .filter((option) => option.startsWith(partial))
      .map(
        (option: string): CompletionItem => ({
          label: option,
          kind: CompletionItemKind.Snippet,
          documentation: {
            kind: 'markdown',
            value: `snippets/${option}.liquid`,
          },
        }),
      );
  }
}
