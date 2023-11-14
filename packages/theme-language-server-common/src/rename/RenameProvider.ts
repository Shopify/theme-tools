import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { SourceCodeType } from '@shopify/theme-check-common';
import { RenameParams, WorkspaceEdit } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../documents';
import { findCurrentNode } from '../visitor';
import { BaseRenameProvider } from './BaseRenameProvider';
import { HtmlTagNameRenameProvider } from './providers/HtmlTagNameRenameProvider';

/**
 * RenameProvider is responsible for providing rename support for the theme language server.
 *
 * Rename is a pretty abstract concept, it can be renaming a tag name, a variable, a class name, etc.
 */
export class RenameProvider {
  private providers: BaseRenameProvider[];

  constructor(private documentManager: DocumentManager) {
    this.providers = [new HtmlTagNameRenameProvider(documentManager)];
  }

  async rename(params: RenameParams): Promise<null | WorkspaceEdit> {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document || document.type !== SourceCodeType.LiquidHtml) {
      return null;
    }

    let currentNode: LiquidHtmlNode | null = null;
    let ancestors: LiquidHtmlNode[] | null = null;

    if (!(document.ast instanceof Error)) {
      [currentNode, ancestors] = findCurrentNode(
        document.ast,
        document.textDocument.offsetAt(params.position),
      );
    }

    if (currentNode === null || ancestors === null) {
      return null;
    }

    const promises = this.providers.map((p) =>
      p
        .rename(currentNode as LiquidHtmlNode, ancestors as LiquidHtmlNode[], params)
        .catch(() => null),
    );
    const results = await Promise.all(promises);
    return results.find(Boolean) ?? null;
  }
}
