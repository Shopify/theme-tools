import { LiquidHtmlNode, LiquidTag, NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { SourceCodeType, visit, isError } from '@shopify/theme-check-common';
import { findInlineSnippetAncestor } from '@shopify/theme-check-common/dist/checks/utils';

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

    if (node.type === NodeTypes.String) {
      const fileSnippets = await this.getSnippetNamesForURI(params.textDocument.uri);
      const fileCompletionItems = fileSnippets.map(
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
      const containingSnippet = findInlineSnippetAncestor(ancestors);
      const containingSnippetName =
        containingSnippet && typeof containingSnippet.markup !== 'string'
          ? containingSnippet.markup.name
          : null;

      const fullAst = params.document.ast;
      const allInlineSnippets = isError(fullAst) ? [] : getInlineSnippetsNames(fullAst);

      const inlineSnippets = allInlineSnippets.filter((name) => name !== containingSnippetName);

      const inlineCompletionItems = inlineSnippets.map(
        (option: string): CompletionItem => ({
          label: option,
          kind: CompletionItemKind.Snippet,
          documentation: {
            kind: 'markdown',
            value: `Inline snippet "${option}"`,
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
  return visit<SourceCodeType.LiquidHtml, string>(ast, {
    LiquidTag(node: LiquidTag) {
      if (node.name === 'snippet' && typeof node.markup !== 'string' && node.markup.name) {
        return node.markup.name;
      }
    },
  });
}
