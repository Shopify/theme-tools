import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams, MarkupKind } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { formatLiquidDocTagHandle, SUPPORTED_LIQUID_DOC_TAG_HANDLES } from '../../utils/liquidDoc';
import { DocumentManager } from '../../documents';

export class LiquidDocTagHoverProvider implements BaseHoverProvider {
  constructor(private documentManager: DocumentManager) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);

    if (
      currentNode.type !== NodeTypes.LiquidDocParamNode &&
      currentNode.type !== NodeTypes.LiquidDocDescriptionNode &&
      currentNode.type !== NodeTypes.LiquidDocExampleNode
    ) {
      return null;
    }

    const document = this.documentManager.get(params.textDocument.uri)?.textDocument;

    // We only want to provide hover when we are on the exact tag name
    // If the cursor is passed that but still within the tag node, we ignore it
    //
    // E.g.
    // Provide hover: @para█m name - description
    // Don't provide hover: @param █name - description
    if (
      document &&
      document.offsetAt(params.position) > currentNode.position.start + currentNode.name.length
    ) {
      return null;
    }

    const docTagData = SUPPORTED_LIQUID_DOC_TAG_HANDLES[currentNode.name];

    if (!docTagData) {
      return null;
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: formatLiquidDocTagHandle(
          currentNode.name,
          docTagData.description,
          docTagData.example,
        ),
      },
    };
  }
}
