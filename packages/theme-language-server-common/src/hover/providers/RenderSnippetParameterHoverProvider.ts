import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, GetDocDefinitionForURI } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocParameter } from '../../utils/liquidDoc';

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

    const snippetDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'snippets',
      parentNode.snippet.value,
    );

    if (!snippetDefinition?.liquidDoc?.parameters?.length) {
      return null;
    }

    const paramName = currentNode.name;
    const hoveredParameter = snippetDefinition.liquidDoc.parameters.find(
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
