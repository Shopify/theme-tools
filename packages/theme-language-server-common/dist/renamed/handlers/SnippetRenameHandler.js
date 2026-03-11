"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnippetRenameHandler = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const documents_1 = require("../../documents");
const uri_1 = require("../../utils/uri");
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
class SnippetRenameHandler {
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
        const relevantRenames = params.files.filter((file) => (0, uri_1.isSnippet)(file.oldUri) && (0, uri_1.isSnippet)(file.newUri));
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
        const oldSnippetName = (0, uri_1.snippetName)(rename.oldUri);
        const newSnippetName = (0, uri_1.snippetName)(rename.newUri);
        const editLabel = `Rename snippet '${oldSnippetName}' to '${newSnippetName}'`;
        const annotationId = 'renameSnippet';
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
                LiquidTag(node) {
                    if (node.name !== liquid_html_parser_1.NamedTags.render && node.name !== liquid_html_parser_1.NamedTags.include) {
                        return;
                    }
                    if (typeof node.markup === 'string') {
                        return;
                    }
                    const snippet = node.markup.snippet;
                    if (snippet.type === liquid_html_parser_1.NodeTypes.String && snippet.value === oldSnippetName) {
                        return {
                            newText: `${newSnippetName}`,
                            range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(snippet.position.start + 1), // +1 to skip the opening quote
                            textDocument.positionAt(snippet.position.end - 1)),
                        };
                    }
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
exports.SnippetRenameHandler = SnippetRenameHandler;
//# sourceMappingURL=SnippetRenameHandler.js.map