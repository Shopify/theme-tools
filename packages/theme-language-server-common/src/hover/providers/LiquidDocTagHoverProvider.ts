import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, MarkupKind } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocTagHandle, SUPPORTED_LIQUID_DOC_TAG_HANDLES } from '../../utils/liquidDoc';

export class LiquidDocTagHoverProvider implements BaseHoverProvider {
  constructor() {}

  async hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);

    let docTagNode;

    // We could be hovering on the liquidDoc tag itself
    if (
      currentNode.type === NodeTypes.LiquidDocParamNode ||
      currentNode.type === NodeTypes.LiquidDocDescriptionNode ||
      currentNode.type === NodeTypes.LiquidDocExampleNode
    ) {
      docTagNode = currentNode;
    }

    // or we could be hovering on the liquidDoc tag's text
    if (
      (parentNode?.type === NodeTypes.LiquidDocParamNode ||
        parentNode?.type === NodeTypes.LiquidDocDescriptionNode ||
        parentNode?.type === NodeTypes.LiquidDocExampleNode) &&
      currentNode.type === NodeTypes.TextNode
    ) {
      docTagNode = parentNode;
    }

    if (!docTagNode) {
      return null;
    }

    const docTagData = SUPPORTED_LIQUID_DOC_TAG_HANDLES[docTagNode.name];

    if (!docTagData) {
      return null;
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: formatLiquidDocTagHandle(
          docTagNode.name,
          docTagData.description,
          docTagData.example,
        ),
      },
    };
  }
}
