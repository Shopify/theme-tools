import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../ClientCapabilities';
import { DocumentManager } from '../documents';
import { FindThemeRootURI } from '../internal-types';
/**
 * The RenameHandler is responsible for handling workspace/didRenameFiles notifications.
 *
 * Stuff we'll handle:
 * - When a snippet is renamed, then we'll change all the render calls
 * - When an asset is renamed, then we'll change the asset_url calls
 * - etc.
 */
export declare class RenameHandler {
    private handlers;
    constructor(connection: Connection, capabilities: ClientCapabilities, documentManager: DocumentManager, findThemeRootURI: FindThemeRootURI);
    onDidRenameFiles(params: RenameFilesParams): Promise<void>;
}
