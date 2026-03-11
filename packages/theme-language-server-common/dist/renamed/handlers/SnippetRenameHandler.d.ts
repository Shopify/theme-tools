import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { BaseRenameHandler } from '../BaseRenameHandler';
import { FindThemeRootURI } from '../../internal-types';
/**
 * The SnippetRenameHandler will handle snippet renames.
 *
 * We'll change all the render and include tags that reference the old snippet
 * to reference the new snippet.
 *
 *   {% render 'oldName' %} -> {% render 'newName' %}
 *
 * We'll do this by visiting all the liquid files in the theme and looking for
 * render and include tags that reference the old snippet. We'll then create a
 * WorkspaceEdit that changes the references to the new snippet.
 */
export declare class SnippetRenameHandler implements BaseRenameHandler {
    private documentManager;
    private connection;
    private capabilities;
    private findThemeRootURI;
    constructor(documentManager: DocumentManager, connection: Connection, capabilities: ClientCapabilities, findThemeRootURI: FindThemeRootURI);
    onDidRenameFiles(params: RenameFilesParams): Promise<void>;
}
