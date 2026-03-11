import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager } from '../../documents';
import { BaseRenameHandler } from '../BaseRenameHandler';
import { FindThemeRootURI } from '../../internal-types';
/**
 * The BlockRenameHandler will handle block renames.
 *
 * Whenever a block gets renamed, a lot of things need to happen:
 *   1. References in files with a {% schema %} must be changed
 *   2. References in template files must be changed
 *   3. References in section groups must be changed
 *   4. References in {% content_for "block", type: "oldName" %} must be changed
 *
 * Things we're not doing:
 *   5. If isPublic(oldName) && isPrivate(newName) && "schema.blocks" accepts "@theme",
 *      Then the block should be added to the "blocks" array
 *
 *    Reasoning: this is more noisy than useful. a now-private block
 *      could be used by a preset, template or section group. Doing a
 *      toil-free rename would require visiting all preset, templates and
 *      section groups to see if a parent that uses the new block name
 *      was supporting "@theme" blocks. It's a lot. It's O(S*(S+T+SG)) where
 *      S is the number of sections, T is the number of templates and SG is the
 *      number of section groups. It's not worth it.
 *
 *      This stuff is complicated enough as it is 😅.
 */
export declare class BlockRenameHandler implements BaseRenameHandler {
    private documentManager;
    private connection;
    private capabilities;
    private findThemeRootURI;
    constructor(documentManager: DocumentManager, connection: Connection, capabilities: ClientCapabilities, findThemeRootURI: FindThemeRootURI);
    onDidRenameFiles(params: RenameFilesParams): Promise<void>;
    private getSchemaChanges;
    private getTemplateChanges;
    private getSectionGroupChanges;
    private getContentForChanges;
}
