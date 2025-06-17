import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../ClientCapabilities';
import { DocumentManager } from '../documents';
import { FindThemeRootURI } from '../internal-types';
import { BaseRenameHandler } from './BaseRenameHandler';
import { AssetRenameHandler } from './handlers/AssetRenameHandler';
import { BlockRenameHandler } from './handlers/BlockRenameHandler';
import { SectionRenameHandler } from './handlers/SectionRenameHandler';
import { SnippetRenameHandler } from './handlers/SnippetRenameHandler';

/**
 * The RenameHandler is responsible for handling workspace/didRenameFiles notifications.
 *
 * Stuff we'll handle:
 * - When a snippet is renamed, then we'll change all the render calls
 * - When an asset is renamed, then we'll change the asset_url calls
 * - etc.
 */
export class RenameHandler {
  private handlers: BaseRenameHandler[];
  constructor(
    connection: Connection,
    capabilities: ClientCapabilities,
    documentManager: DocumentManager,
    findThemeRootURI: FindThemeRootURI,
  ) {
    this.handlers = [
      new SnippetRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
      new AssetRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
      new BlockRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
      new SectionRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
    ];
  }

  async onDidRenameFiles(params: RenameFilesParams) {
    try {
      const promises = this.handlers.map((handler) => handler.onDidRenameFiles(params));
      await Promise.all(promises);
    } catch (error) {
      console.error(error);
      return;
    }
  }
}
