import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { RenameParams, WorkspaceEdit } from 'vscode-languageserver-protocol';

export interface BaseRenameProvider {
  rename(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: RenameParams,
  ): Promise<null | WorkspaceEdit>;
}
