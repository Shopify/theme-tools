import { NodeTypes } from '@shopify/liquid-html-parser';
import {
  LiquidHtmlNode,
  LiquidDocParameter,
  GetDocDefinitionForURI,
  path,
} from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocParameter } from '../../utils/liquidDoc';

export class RenderSnippetHoverProvider implements BaseHoverProvider {
  constructor(private getDocDefinitionForURI: GetDocDefinitionForURI) {}

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
    const snippetDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'snippets',
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
          value: `### ${snippetName}`,
        },
      };
    }

    const parts = [`### ${snippetName}`];

    if (liquidDoc.description) {
      const description = liquidDoc.description.content;
      parts.push('', '**Description:**', '\n', description);
    }

    if (liquidDoc.parameters?.length) {
      const parameters = this.buildParameters(liquidDoc.parameters);
      parts.push('', '**Parameters:**', parameters);
    }

    if (liquidDoc.examples?.length) {
      const examples = liquidDoc.examples
        ?.map(({ content }) => `\`\`\`liquid\n${content}\n\`\`\``)
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
