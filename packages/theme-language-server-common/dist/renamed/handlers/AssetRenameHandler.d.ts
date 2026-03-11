import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { BaseRenameHandler } from '../BaseRenameHandler';
import { FindThemeRootURI } from '../../internal-types';
/**
 * The AssetRenameHandler will handle asset renames.
 *
 * We'll change all the `| asset_url` that reference the old asset:
 *   {{ 'oldName.js' | asset_url }} -> {{ 'newName.js' | asset_url }}
 *
 * We'll do that for `.(css|js).liquid` files as well
 *
 * We'll do this by visiting all the liquid files in the theme and looking for
 * string | asset_url Variable nodes that reference the old asset. We'll then create a
 * WorkspaceEdit that changes the references to the new asset.
 */
export declare class AssetRenameHandler implements BaseRenameHandler {
    private documentManager;
    private connection;
    private capabilities;
    private findThemeRootURI;
    constructor(documentManager: DocumentManager, connection: Connection, capabilities: ClientCapabilities, findThemeRootURI: FindThemeRootURI);
    onDidRenameFiles(params: RenameFilesParams): Promise<void>;
}
