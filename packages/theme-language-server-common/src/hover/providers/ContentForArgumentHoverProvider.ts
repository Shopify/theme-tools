import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, GetDocDefinitionForURI, getBlockName } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocParameter } from '../../utils/liquidDoc';

export class ContentForArgumentHoverProvider implements BaseHoverProvider {
  constructor(private getDocDefinitionForURI: GetDocDefinitionForURI) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
    if (
      currentNode.type !== NodeTypes.NamedArgument ||
      !parentNode ||
      parentNode.type !== NodeTypes.ContentForMarkup ||
      parentNode.contentForType.type !== NodeTypes.String
    ) {
      return null;
    }

    const blockName = getBlockName(parentNode);

    if (!blockName) {
      return null;
    }

    const docDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'blocks',
      blockName,
    );

    const hoverArgument = docDefinition?.liquidDoc?.parameters?.find(
      (argument) => argument.name === currentNode.name,
    );

    if (!hoverArgument) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: formatLiquidDocParameter(hoverArgument, true),
      },
    };
  }
}
