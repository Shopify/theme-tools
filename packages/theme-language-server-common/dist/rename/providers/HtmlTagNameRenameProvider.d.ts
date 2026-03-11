import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { PrepareRenameParams, PrepareRenameResult, RenameParams, WorkspaceEdit } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { BaseRenameProvider } from '../BaseRenameProvider';
export declare class HtmlTagNameRenameProvider implements BaseRenameProvider {
    private documentManager;
    constructor(documentManager: DocumentManager);
    prepare(node: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: PrepareRenameParams): Promise<null | PrepareRenameResult>;
    rename(node: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: RenameParams): Promise<null | WorkspaceEdit>;
}
