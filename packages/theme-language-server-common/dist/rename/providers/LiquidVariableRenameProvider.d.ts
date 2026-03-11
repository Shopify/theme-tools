import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { Connection } from 'vscode-languageserver';
import { PrepareRenameParams, PrepareRenameResult, RenameParams, WorkspaceEdit } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { FindThemeRootURI } from '../../internal-types';
import { BaseRenameProvider } from '../BaseRenameProvider';
export declare class LiquidVariableRenameProvider implements BaseRenameProvider {
    private connection;
    private clientCapabilities;
    private documentManager;
    private findThemeRootURI;
    constructor(connection: Connection, clientCapabilities: ClientCapabilities, documentManager: DocumentManager, findThemeRootURI: FindThemeRootURI);
    prepare(node: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: PrepareRenameParams): Promise<null | PrepareRenameResult>;
    rename(node: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: RenameParams): Promise<null | WorkspaceEdit>;
}
