import { NodeTypes } from '@shopify/liquid-html-parser';
import {
  LiquidHtmlNode,
  GetDocDefinitionForURI,
  findInlineSnippet,
  extractDocDefinition,
} from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocContentMarkdown } from '../../utils/liquidDoc';

export class RenderSnippetHoverProvider implements BaseHoverProvider {
  constructor(private getDocDefinitionForURI: GetDocDefinitionForURI) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);

    if (parentNode?.type === NodeTypes.RenderMarkup) {
      let snippetName: string;
      let docDefinition;

      if (currentNode.type === NodeTypes.String) {
        snippetName = currentNode.value;
        docDefinition = await this.getDocDefinitionForURI(
          params.textDocument.uri,
          'snippets',
          snippetName,
        );
      } else if (currentNode.type === NodeTypes.VariableLookup) {
        snippetName = currentNode.name || '';
        const rootNode = ancestors[0];
        const snippetNode = findInlineSnippet(rootNode, snippetName);
        if (snippetNode) {
          docDefinition = extractDocDefinition(params.textDocument.uri, snippetNode);
        }
      } else {
        return null;
      }

      return {
        contents: {
          kind: 'markdown',
          value: formatLiquidDocContentMarkdown(snippetName, docDefinition || undefined),
        },
      };
    }

    return null;
  }
}
