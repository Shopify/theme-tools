import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import {
  DefinitionLink,
  DefinitionParams,
  LocationLink,
  Range,
} from 'vscode-languageserver-protocol';

import { DocumentLinksProvider } from '../../documentLinks';
import { DocumentManager } from '../../documents';
import { FindThemeRootURI } from '../../internal-types';
import { BaseDefinitionProvider } from '../BaseDefinitionProvider';

export class DocumentLinksDefinitionProvider implements BaseDefinitionProvider {
  private documentLinksProvider: DocumentLinksProvider;

  constructor(
    private documentManager: DocumentManager,
    findThemeRootURI: FindThemeRootURI,
  ) {
    this.documentLinksProvider = new DocumentLinksProvider(documentManager, findThemeRootURI);
  }

  async definitions(
    params: DefinitionParams,
    _node: LiquidHtmlNode,
    _ancestors: LiquidHtmlNode[],
  ): Promise<DefinitionLink[]> {
    const sourceCode = this.documentManager.get(params.textDocument.uri);
    if (!sourceCode) {
      return [];
    }

    const cursorOffset = sourceCode.textDocument.offsetAt(params.position);
    const links = await this.documentLinksProvider.documentLinks(params.textDocument.uri);

    const activeLink = links.find(({ range, target }) => {
      if (!target) return false;

      const start = sourceCode.textDocument.offsetAt(range.start);
      const end = sourceCode.textDocument.offsetAt(range.end);
      return cursorOffset >= start && cursorOffset <= end;
    });

    if (!activeLink?.target) {
      return [];
    }

    // Unknown target document range is represented by the start of file.
    const targetRange = Range.create(0, 0, 0, 0);

    return [
      LocationLink.create(activeLink.target, targetRange, targetRange, activeLink.range),
    ];
  }
}
