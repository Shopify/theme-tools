import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

export type GetSnippetNamesForURI = (uri: string) => Promise<string[]>;

export class RenderSnippetCompletionProvider implements Provider {
  constructor(private readonly getSnippetNamesForURI: GetSnippetNamesForURI = async () => []) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node } = params.completionContext;

    if (!node || node.type !== NodeTypes.RenderMarkup || node.snippet.type !== NodeTypes.String) {
      return [];
    }

    const options = await this.getSnippetNamesForURI(params.textDocument.uri);
    const partial = node.snippet.value;

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
