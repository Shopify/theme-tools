import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { LiquidDocDefinition, LiquidDocParameter } from '../../liquidDoc';

export class RenderSnippetHoverProvider implements BaseHoverProvider {
  constructor(
    private getLiquidDocDefinitionsForURI: (
      uri: string,
      snippetName: string,
    ) => Promise<LiquidDocDefinition>,
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
    const liquidDocDefinition = await this.getLiquidDocDefinitionsForURI(
      params.textDocument.uri,
      snippetName,
    );

    if (!liquidDocDefinition) {
      return {
        contents: {
          kind: 'markdown',
          value: `### ${snippetName}`,
        },
      };
    }

    const parameterDocs = liquidDocDefinition.parameters
      ?.map(
        (param: LiquidDocParameter) =>
          `- \`${param.name}\`${param.type ? `: ${param.type}` : ''} - ${param.description || ''}`,
      )
      .join('\n');

    const parts = [`### ${liquidDocDefinition.name}`];
    if (parameterDocs) {
      parts.push('', '**Parameters:**', parameterDocs);
    }

    return {
      contents: {
        kind: 'markdown',
        value: parts.join('\n'),
      },
    };
  }
}
