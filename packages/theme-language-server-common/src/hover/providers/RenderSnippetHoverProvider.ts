import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { SnippetDefinition, LiquidDocParameter } from '../../liquidDoc';

export class RenderSnippetHoverProvider implements BaseHoverProvider {
  constructor(
    private getSnippetDefinitionForURI: (
      uri: string,
      snippetName: string,
    ) => Promise<SnippetDefinition>,
  ) {}

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
    const snippetDefinition = await this.getSnippetDefinitionForURI(
      params.textDocument.uri,
      snippetName,
    );

    const liquidDoc = snippetDefinition.liquidDoc;

    if (!liquidDoc) {
      return {
        contents: {
          kind: 'markdown',
          value: `### ${snippetDefinition.name}`,
        },
      };
    }

    const parts = [`### ${snippetDefinition.name}`];

    if (liquidDoc.parameters?.length) {
      const parameters = liquidDoc.parameters
        ?.map(
          ({ name, type, description }: LiquidDocParameter) =>
            `- \`${name}\`${type ? `: ${type}` : ''} ${description ? `- ${description}` : ''}`,
        )
        .join('\n');

      parts.push('', '**Parameters:**', parameters);
    }

    return {
      contents: {
        kind: 'markdown',
        value: parts.join('\n'),
      },
    };
  }
}
