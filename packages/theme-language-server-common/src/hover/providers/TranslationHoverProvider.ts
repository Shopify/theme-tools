import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../translations';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class TranslationHoverProvider implements BaseHoverProvider {
  constructor(
    public getTranslationsForUri: GetTranslationsForURI,
    public documentManager: DocumentManager,
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
      parentNode.type !== NodeTypes.LiquidVariable
    ) {
      return null;
    }

    if (!parentNode.filters[0] || !['t', 'translate'].includes(parentNode.filters[0].name)) {
      return null;
    }

    const translations = await this.getTranslationsForUri(params.textDocument.uri);
    const translation = translationValue(currentNode.value, translations);
    const document = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!translation || !document) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: renderTranslation(translation),
      },
      range: {
        start: document.positionAt(currentNode.position.start),
        end: document.positionAt(currentNode.position.end),
      },
    };
  }
}
