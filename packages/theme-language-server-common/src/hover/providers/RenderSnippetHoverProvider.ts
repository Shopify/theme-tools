import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, SnippetDefinition, LiquidDocParameter } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocParameter } from '../../utils/liquidDoc';

export class RenderSnippetHoverProvider implements BaseHoverProvider {
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

    if (!snippetDefinition) {
      return null;
    }

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

    if (liquidDoc.description) {
      const description = liquidDoc.description.content;
      parts.push('', '**Description:**', '\n', `\`\`\`plaintext\n${description}\n\`\`\``);
    }

    if (liquidDoc.parameters?.length) {
      const parameters = this.buildParameters(liquidDoc.parameters);
      parts.push('', '**Parameters:**', parameters);
    }

    if (liquidDoc.examples?.length) {
      const examples = liquidDoc.examples
        ?.map(({ content }) => `\`\`\`liquid${content}\`\`\``)
        .join('\n');

      parts.push('', '**Examples:**', examples);
    }

    return {
      contents: {
        kind: 'markdown',
        value: parts.join('\n'),
      },
    };
  }

  private buildParameters(parameters: LiquidDocParameter[]) {
    return parameters.map((param) => formatLiquidDocParameter(param)).join('\n');
  }
}
