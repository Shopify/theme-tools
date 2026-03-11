import { PrepareRenameParams, PrepareRenameResult, RenameParams, WorkspaceEdit } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../documents';
import { Connection } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { FindThemeRootURI } from '../internal-types';
/**
 * RenameProvider is responsible for providing rename support for the theme language server.
 *
 * Rename is a pretty abstract concept, it can be renaming a tag name, a variable, a class name, etc.
 */
export declare class RenameProvider {
    private documentManager;
    private providers;
    constructor(connection: Connection, clientCapabilities: ClientCapabilities, documentManager: DocumentManager, findThemeRootURI: FindThemeRootURI);
    /** Prepare is for telling if you can rename this thing or not, and what text to rename */
    prepare(params: PrepareRenameParams): Promise<null | PrepareRenameResult>;
    /** Rename is for actually renaming something */
    rename(params: RenameParams): Promise<null | WorkspaceEdit>;
    /** a helper for getting the node under the cursor and its ancestry */
    private nodes;
}
