"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetRenameHandler = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const documents_1 = require("../../documents");
const uri_1 = require("../../utils/uri");
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
class AssetRenameHandler {
    constructor(documentManager, connection, capabilities, findThemeRootURI) {
        this.documentManager = documentManager;
        this.connection = connection;
        this.capabilities = capabilities;
        this.findThemeRootURI = findThemeRootURI;
    }
    async onDidRenameFiles(params) {
        var _a;
        if (!this.capabilities.hasApplyEditSupport)
            return;
        const relevantRenames = params.files.filter((file) => (0, uri_1.isAsset)(file.oldUri) && (0, uri_1.isAsset)(file.newUri));
        // Only preload if you have something to do (folder renames are not supported)
        if (relevantRenames.length !== 1)
            return;
        const rename = relevantRenames[0];
        const rootUri = await this.findThemeRootURI(theme_check_common_1.path.dirname(params.files[0].oldUri));
        if (!rootUri)
            return;
        await this.documentManager.preload(rootUri);
        const theme = this.documentManager.theme(rootUri, true);
        const liquidSourceCodes = theme.filter(documents_1.isLiquidSourceCode);
        const oldAssetName = (0, uri_1.assetName)(rename.oldUri);
        const newAssetName = (0, uri_1.assetName)(rename.newUri);
        const editLabel = `Rename asset '${oldAssetName}' to '${newAssetName}'`;
        const annotationId = 'renameAsset';
        const workspaceEdit = {
            documentChanges: [],
            changeAnnotations: {
                [annotationId]: {
                    label: editLabel,
                    needsConfirmation: false,
                },
            },
        };
        for (const sourceCode of liquidSourceCodes) {
            if (sourceCode.ast instanceof Error)
                continue;
            const textDocument = sourceCode.textDocument;
            const edits = (0, theme_check_common_1.visit)(sourceCode.ast, {
                LiquidVariable(node) {
                    if (node.filters.length === 0)
                        return;
                    if (node.expression.type !== liquid_html_parser_1.NodeTypes.String)
                        return;
                    if (node.filters[0].name !== 'asset_url')
                        return;
                    const assetName = node.expression.value;
                    if (assetName !== oldAssetName)
                        return;
                    return {
                        newText: newAssetName,
                        range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(node.expression.position.start + 1), // +1 to skip the opening quote
                        textDocument.positionAt(node.expression.position.end - 1)),
                    };
                },
            });
            if (edits.length === 0)
                continue;
            workspaceEdit.documentChanges.push({
                textDocument: {
                    uri: textDocument.uri,
                    version: (_a = sourceCode.version) !== null && _a !== void 0 ? _a : null /* null means file from disk in this API */,
                },
                annotationId,
                edits,
            });
        }
        if (workspaceEdit.documentChanges.length === 0) {
            console.error('Nothing to do!');
            return;
        }
        await this.connection.sendRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, {
            label: editLabel,
            edit: workspaceEdit,
        });
    }
}
exports.AssetRenameHandler = AssetRenameHandler;
//# sourceMappingURL=AssetRenameHandler.js.map