import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { DocumentHighlightParams, Range } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseDocumentHighlightsProvider } from '../BaseDocumentHighlightsProvider';

export class LiquidBlockTagDocumentHighlightsProvider implements BaseDocumentHighlightsProvider {
  constructor(public documentManager: DocumentManager) {}

  async documentHighlights(
    node: LiquidHtmlNode,
    _ancestors: LiquidHtmlNode[],
    params: DocumentHighlightParams,
  ) {
    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!textDocument) return null;

    if (node.type !== NodeTypes.LiquidTag || !node.blockEndPosition) {
      return null;
    }

    const nameOffset = node.source.indexOf(node.name, node.blockStartPosition.start);
    const endblockNameOffset = node.source.indexOf('end' + node.name, node.blockEndPosition.start);

    const startRange = Range.create(
      textDocument.positionAt(nameOffset),
      textDocument.positionAt(nameOffset + node.name.length),
    );

    // TODO should add named branches here (e.g. else/elsif/when)

    const endRange = Range.create(
      // </ means offset 2 characters
      textDocument.positionAt(endblockNameOffset),
      textDocument.positionAt(endblockNameOffset + 3 + node.name.length),
    );
    return [{ range: startRange }, { range: endRange }];
  }
}
