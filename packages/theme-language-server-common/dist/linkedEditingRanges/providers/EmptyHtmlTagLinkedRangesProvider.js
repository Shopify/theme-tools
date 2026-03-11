"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyHtmlTagLinkedRangesProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const wordPattern_1 = require("../wordPattern");
class EmptyHtmlTagLinkedRangesProvider {
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    async linkedEditingRanges(node, ancestors, { textDocument: { uri }, position }) {
        // We're strictly checking for <></> and cursor in either branch, that's a parse error
        // ... but it's fine because <></> is rather easy to find.
        if (node !== null || ancestors !== null)
            return null;
        const document = this.documentManager.get(uri);
        const textDocument = document === null || document === void 0 ? void 0 : document.textDocument;
        if (!document || !textDocument)
            return null;
        const openRange = vscode_languageserver_1.Range.create(vscode_languageserver_1.Position.create(position.line, position.character - 1), vscode_languageserver_1.Position.create(position.line, position.character + 1));
        if (!['<>', '< '].includes(textDocument.getText(openRange)))
            return null;
        const closeOffset = document.source.indexOf('</>', textDocument.offsetAt(position));
        if (closeOffset === -1)
            return null;
        const afterSlashOffset = closeOffset + 2;
        const afterSlashPosition = textDocument.positionAt(afterSlashOffset);
        return {
            ranges: [
                vscode_languageserver_1.Range.create(position, position),
                vscode_languageserver_1.Range.create(afterSlashPosition, afterSlashPosition),
            ],
            wordPattern: wordPattern_1.htmlElementNameWordPattern,
        };
    }
}
exports.EmptyHtmlTagLinkedRangesProvider = EmptyHtmlTagLinkedRangesProvider;
//# sourceMappingURL=EmptyHtmlTagLinkedRangesProvider.js.map