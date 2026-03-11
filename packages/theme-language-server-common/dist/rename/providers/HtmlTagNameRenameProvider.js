"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlTagNameRenameProvider = void 0;
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const htmlTagNames_1 = require("../../utils/htmlTagNames");
class HtmlTagNameRenameProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async prepare(node, ancestors, params) {
        var _a;
        const textDocument = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!textDocument || !node || !ancestors)
            return null;
        const ranges = (0, htmlTagNames_1.getHtmlElementNameRanges)(node, ancestors, params, textDocument);
        if (!ranges || !ranges[0])
            return null;
        return {
            range: ranges[0],
            placeholder: textDocument.getText(ranges[0]),
        };
    }
    async rename(node, ancestors, params) {
        var _a;
        const textDocument = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!textDocument || !node || !ancestors)
            return null;
        const ranges = (0, htmlTagNames_1.getHtmlElementNameRanges)(node, ancestors, params, textDocument);
        if (!ranges)
            return null;
        const textDocumentEdit = vscode_languageserver_protocol_1.TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, toTextEdits(ranges, params.newName));
        return {
            documentChanges: [textDocumentEdit],
        };
    }
}
exports.HtmlTagNameRenameProvider = HtmlTagNameRenameProvider;
function toTextEdits(ranges, newText) {
    return ranges.map((range) => vscode_languageserver_protocol_1.TextEdit.replace(range, newText));
}
//# sourceMappingURL=HtmlTagNameRenameProvider.js.map