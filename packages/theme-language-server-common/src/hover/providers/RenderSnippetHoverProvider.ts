import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { SnippetDefinition, LiquidDocParameter } from '../../liquidDoc';

/**
 * @param x {string} asdf
 */
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

    const snippetName = currentNode.value.replace(/['"]/g, '');
    const snippetDefinition = await this.getSnippetDefinitionForURI(
      params.textDocument.uri,
      snippetName,
    );

    if (!snippetDefinition.liquidDoc) {
      return {
        contents: {
          kind: 'markdown',
          value: `### ${snippetDefinition.name}`,
        },
      };
    }

    const liquidDoc = snippetDefinition.liquidDoc;

    const parameters = liquidDoc.parameters
      ?.map(
        (param: LiquidDocParameter) =>
          `- \`${param.name}\`${param.type ? `: ${param.type}` : ''} - ${param.description || ''}`,
      )
      .join('\n');

    const parts = [`### ${snippetDefinition.name}`];
    if (parameters) {
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
