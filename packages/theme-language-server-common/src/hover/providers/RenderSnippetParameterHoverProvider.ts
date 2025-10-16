import { NodeTypes } from '@shopify/liquid-html-parser';
import {
  LiquidHtmlNode,
  GetDocDefinitionForURI,
  findInlineSnippet,
  extractDocDefinition,
} from '@shopify/theme-check-common';
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
      parentNode.type !== NodeTypes.RenderMarkup
    ) {
      return null;
    }

    let docDefinition;

    if (parentNode.snippet.type === NodeTypes.String) {
      docDefinition = await this.getDocDefinitionForURI(
        params.textDocument.uri,
        'snippets',
        parentNode.snippet.value,
      );
    } else if (parentNode.snippet.type === NodeTypes.VariableLookup) {
      const snippetName = parentNode.snippet.name || '';
      const rootNode = ancestors[0];
      const snippetNode = findInlineSnippet(rootNode, snippetName);
      if (snippetNode) {
        docDefinition = extractDocDefinition(params.textDocument.uri, snippetNode);
      }
    }

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
