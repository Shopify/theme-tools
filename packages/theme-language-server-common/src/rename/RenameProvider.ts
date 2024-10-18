import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { SourceCodeType } from '@shopify/theme-check-common';
import {
  PrepareRenameParams,
  PrepareRenameResult,
  RenameParams,
  TextDocumentPositionParams,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { DocumentManager } from '../documents';
import { findCurrentNode } from '../visitor';
import { BaseRenameProvider } from './BaseRenameProvider';
import { HtmlTagNameRenameProvider } from './providers/HtmlTagNameRenameProvider';
import { LiquidVariableRenameProvider } from './providers/LiquidVariableRenameProvider';

/**
 * RenameProvider is responsible for providing rename support for the theme language server.
 *
 * Rename is a pretty abstract concept, it can be renaming a tag name, a variable, a class name, etc.
 */
export class RenameProvider {
  private providers: BaseRenameProvider[];

  constructor(private documentManager: DocumentManager) {
    this.providers = [
      new HtmlTagNameRenameProvider(documentManager),
      new LiquidVariableRenameProvider(documentManager),
    ];
  }

  /** Prepare is for telling if you can rename this thing or not, and what text to rename */
  async prepare(params: PrepareRenameParams): Promise<null | PrepareRenameResult> {
    const [currentNode, ancestors] = this.nodes(params);
    if (currentNode === null || ancestors === null) {
      return null;
    }

    const promises = this.providers.map((provider) =>
      provider
        .prepare(currentNode as LiquidHtmlNode, ancestors as LiquidHtmlNode[], params)
        .catch(() => null),
    );
    const results = await Promise.all(promises);
    return results.find(Boolean) ?? null;
  }

  /** Rename is for actually renaming something */
  async rename(params: RenameParams): Promise<null | WorkspaceEdit> {
    const [currentNode, ancestors] = this.nodes(params);
    if (currentNode === null || ancestors === null) {
      return null;
    }

    const promises = this.providers.map((provider) =>
      provider
        .rename(currentNode as LiquidHtmlNode, ancestors as LiquidHtmlNode[], params)
        .catch(() => null),
    );
    const results = await Promise.all(promises);
    return results.find(Boolean) ?? null;
  }

  /** a helper for getting the node under the cursor and its ancestry */
  private nodes(
    params: TextDocumentPositionParams,
  ): [LiquidHtmlNode, LiquidHtmlNode[]] | [null, null] {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document || document.type !== SourceCodeType.LiquidHtml) {
      return [null, null];
    }

    if (!(document.ast instanceof Error)) {
      return findCurrentNode(document.ast, document.textDocument.offsetAt(params.position));
    }

    return [null, null];
  }
}
