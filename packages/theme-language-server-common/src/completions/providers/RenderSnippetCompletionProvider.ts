import { LiquidHtmlNode, LiquidTag, NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { SourceCodeType, visit } from '@shopify/theme-check-common';

export type GetSnippetNamesForURI = (uri: string) => Promise<string[]>;

export class RenderSnippetCompletionProvider implements Provider {
  constructor(private readonly getSnippetNamesForURI: GetSnippetNamesForURI = async () => []) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (!node || !parentNode || parentNode.type !== NodeTypes.RenderMarkup) {
      return [];
    }

    let partial = '';
    if (node.type === NodeTypes.String) {
      partial = node.value;
      const fileSnippets = await this.getSnippetNamesForURI(params.textDocument.uri);
      const fileCompletionItems = fileSnippets
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
      return fileCompletionItems;
    } else if (node.type === NodeTypes.VariableLookup) {
      partial = node.name || '';
      const inlineSnippets = getInlineSnippetsNames(params.completionContext.partialAst);
      const inlineCompletionItems = inlineSnippets
        .filter((option) => option.startsWith(partial))
        .map(
          (option: string): CompletionItem => ({
            label: option,
            kind: CompletionItemKind.Snippet,
            documentation: {
              kind: 'markdown',
              value: `Inline snippet (defined in this file)`,
            },
          }),
        );
      return inlineCompletionItems;
    } else {
      return [];
    }
  }
}

function getInlineSnippetsNames(ast: LiquidHtmlNode): string[] {
  if (ast instanceof Error) return [];

  const inlineSnippetNames = visit<SourceCodeType.LiquidHtml, string>(ast, {
    LiquidTag(node: LiquidTag) {
      if (node.name === 'snippet' && typeof node.markup !== 'string' && node.markup.name) {
        return node.markup.name;
      }
    },
  });

  return inlineSnippetNames.filter((name): name is string => !!name);
}
