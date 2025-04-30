import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, GetDocDefinitionForURI } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocContentMarkdown } from '../../utils/liquidDoc';

export class ContentForTypeHoverProvider implements BaseHoverProvider {
  constructor(private getDocDefinitionForURI: GetDocDefinitionForURI) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
    const grandParentNode = ancestors.at(-2);
    if (
      currentNode.type !== NodeTypes.String ||
      !parentNode ||
      !grandParentNode ||
      parentNode.type !== NodeTypes.NamedArgument ||
      parentNode.name !== 'type' ||
      grandParentNode.type !== NodeTypes.ContentForMarkup
    ) {
      return null;
    }

    const blockName = currentNode.value;
    const docDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'blocks',
      blockName,
    );

    return {
      contents: {
        kind: 'markdown',
        value: formatLiquidDocContentMarkdown(blockName, docDefinition),
      },
    };
  }
}
