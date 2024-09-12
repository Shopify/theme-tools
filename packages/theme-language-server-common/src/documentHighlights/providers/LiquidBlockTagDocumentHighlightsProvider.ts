import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { DocumentHighlightParams, Range } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseDocumentHighlightsProvider } from '../BaseDocumentHighlightsProvider';
import { isLiquidBranch } from '@shopify/theme-check-common/src/checks/utils';

export class LiquidBlockTagDocumentHighlightsProvider implements BaseDocumentHighlightsProvider {
  constructor(public documentManager: DocumentManager) {}

  async documentHighlights(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: DocumentHighlightParams,
  ) {
    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument) return null;

    if (isLiquidBranch(node)) {
      node = ancestors.at(-1)!;
    }

    if (node.type !== NodeTypes.LiquidTag || !node.blockEndPosition) {
      return null;
    }

    const nameOffset = node.source.indexOf(node.name, node.blockStartPosition.start);
    const endblockNameOffset = node.source.indexOf('end' + node.name, node.blockEndPosition.start);

    const ranges: Range[] = [
      Range.create(
        textDocument.positionAt(nameOffset),
        textDocument.positionAt(nameOffset + node.name.length),
      ),
      Range.create(
        // </ means offset 2 characters
        textDocument.positionAt(endblockNameOffset),
        textDocument.positionAt(endblockNameOffset + 3 + node.name.length),
      ),
    ];

    // highlighting the elsif/else branches as well
    if (node.children && node.children.every(isLiquidBranch)) {
      for (const branch of node.children.filter((x) => x.name !== null)) {
        const branchNameOffset = node.source.indexOf(branch.name!, branch.blockStartPosition.start);
        ranges.push(
          Range.create(
            textDocument.positionAt(branchNameOffset),
            textDocument.positionAt(branchNameOffset + branch.name!.length),
          ),
        );
      }
    }

    return ranges.map((range) => ({ range }));
  }
}
