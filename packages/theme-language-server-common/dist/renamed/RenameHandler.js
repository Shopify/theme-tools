"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameHandler = void 0;
const AssetRenameHandler_1 = require("./handlers/AssetRenameHandler");
const BlockRenameHandler_1 = require("./handlers/BlockRenameHandler");
const SectionRenameHandler_1 = require("./handlers/SectionRenameHandler");
const SnippetRenameHandler_1 = require("./handlers/SnippetRenameHandler");
/**
 * The RenameHandler is responsible for handling workspace/didRenameFiles notifications.
 *
 * Stuff we'll handle:
 * - When a snippet is renamed, then we'll change all the render calls
 * - When an asset is renamed, then we'll change the asset_url calls
 * - etc.
 */
class RenameHandler {
    constructor(connection, capabilities, documentManager, findThemeRootURI) {
        this.handlers = [
            new SnippetRenameHandler_1.SnippetRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
            new AssetRenameHandler_1.AssetRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
            new BlockRenameHandler_1.BlockRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
            new SectionRenameHandler_1.SectionRenameHandler(documentManager, connection, capabilities, findThemeRootURI),
        ];
    }
    async onDidRenameFiles(params) {
        try {
            const promises = this.handlers.map((handler) => handler.onDidRenameFiles(params));
            await Promise.all(promises);
        }
        catch (error) {
            console.error(error);
            return;
        }
    }
}
exports.RenameHandler = RenameHandler;
//# sourceMappingURL=RenameHandler.js.map