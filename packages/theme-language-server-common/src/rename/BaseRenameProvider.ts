import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import {
  PrepareRenameParams,
  PrepareRenameResult,
  RenameParams,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';

export interface BaseRenameProvider {
  prepare(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: PrepareRenameParams,
  ): Promise<null | PrepareRenameResult>;

  rename(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: RenameParams,
  ): Promise<null | WorkspaceEdit>;
}
