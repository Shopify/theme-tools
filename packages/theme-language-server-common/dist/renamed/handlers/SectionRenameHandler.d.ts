import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { FindThemeRootURI } from '../../internal-types';
import { BaseRenameHandler } from '../BaseRenameHandler';
/**
 * The SectionRenameHandler will handle section renames
 *
 * Whenever a section gets renamed, a lot of things need to happen:
 *   2. References in template files must be changed
 *   3. References in section groups must be changed
 *   4. References like {% section "oldName" %} must be changed
 */
export declare class SectionRenameHandler implements BaseRenameHandler {
    private documentManager;
    private connection;
    private capabilities;
    private findThemeRootURI;
    constructor(documentManager: DocumentManager, connection: Connection, capabilities: ClientCapabilities, findThemeRootURI: FindThemeRootURI);
    onDidRenameFiles(params: RenameFilesParams): Promise<void>;
    private getTemplateChanges;
    private getSectionGroupChanges;
    private getSectionTagChanges;
}
