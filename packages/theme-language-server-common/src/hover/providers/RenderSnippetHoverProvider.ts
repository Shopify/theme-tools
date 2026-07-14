import { NodeTypes } from '@shopify/liquid-html-parser';
import { GetDocDefinitionForURI, LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { formatLiquidDocContentMarkdown } from '../../utils/liquidDoc';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class RenderSnippetHoverProvider implements BaseHoverProvider {
  constructor(private getDocDefinitionForURI: GetDocDefinitionForURI) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
    if (
      currentNode.type !== NodeTypes.String ||
      !parentNode ||
      parentNode.type !== NodeTypes.RenderMarkup
    ) {
      return null;
    }

    const snippetName = currentNode.value;
    const docDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'snippets',
      snippetName,
    );

    return {
      contents: {
        kind: 'markdown',
        value: formatLiquidDocContentMarkdown(snippetName, docDefinition),
      },
    };
  }
}
