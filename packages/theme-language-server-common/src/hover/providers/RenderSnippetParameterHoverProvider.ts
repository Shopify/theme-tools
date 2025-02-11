import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, SnippetDefinition, LiquidDocParameter } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class RenderSnippetParameterHoverProvider implements BaseHoverProvider {
  constructor(
    private getSnippetDefinitionForURI: (
      uri: string,
      snippetName: string,
    ) => Promise<SnippetDefinition | undefined>,
  ) {}

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

    const snippetName = parentNode.snippet.value;
    const snippetDefinition = await this.getSnippetDefinitionForURI(
      params.textDocument.uri,
      snippetName,
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

    const parts = [];
    parts.push(
      hoveredParameter.type
        ? `\`${hoveredParameter.name}\`: \`${hoveredParameter.type}\``
        : `\`${hoveredParameter.name}\``,
    );

    if (hoveredParameter.description) {
      parts.push(`- ${hoveredParameter.description}`);
    }

    return {
      contents: {
        kind: 'markdown',
        value: parts.join('\n'),
      },
    };
  }
}
