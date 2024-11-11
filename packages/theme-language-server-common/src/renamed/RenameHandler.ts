import { FileExists, findRoot, path } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../ClientCapabilities';
import { DocumentManager } from '../documents';
import { BaseRenameHandler } from './BaseRenameHandler';
import { AssetRenameHandler } from './handlers/AssetRenameHandler';
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
    private documentManager: DocumentManager,
    private fileExists: FileExists,
  ) {
    this.handlers = [
      new SnippetRenameHandler(connection, capabilities),
      new AssetRenameHandler(connection, capabilities),
    ];
  }

  async onDidRenameFiles(params: RenameFilesParams) {
    const rootUri = await findRoot(path.dirname(params.files[0].oldUri), this.fileExists);
    await this.documentManager.preload(rootUri);
    const theme = this.documentManager.theme(rootUri, true);
    const promises = this.handlers.map((handler) => handler.onDidRenameFiles(params, theme));
    await Promise.all(promises);
  }
}
