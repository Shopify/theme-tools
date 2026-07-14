import { NodeTypes } from '@shopify/liquid-html-parser';
import { GetDocDefinitionForURI, LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { formatLiquidDocParameter } from '../../utils/liquidDoc';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class RenderSnippetParameterHoverProvider implements BaseHoverProvider {
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
      parentNode.type !== NodeTypes.RenderMarkup ||
      parentNode.snippet.type !== NodeTypes.String
    ) {
      return null;
    }

    const docDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'snippets',
      parentNode.snippet.value,
    );

    const paramName = currentNode.name;
    const hoveredParameter = docDefinition?.liquidDoc?.parameters?.find(
      (parameter) => parameter.name === paramName,
    );

    if (!hoveredParameter) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: formatLiquidDocParameter(hoveredParameter, true),
      },
    };
  }
}
