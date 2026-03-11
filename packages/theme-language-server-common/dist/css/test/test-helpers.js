"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestParams = getRequestParams;
exports.isCompletionList = isCompletionList;
function getRequestParams(documentManager, relativePath, source) {
    const uri = `file:///root/${relativePath}`;
    const sourceWithoutCursor = source.replace('█', '');
    documentManager.open(uri, sourceWithoutCursor, 1);
    const doc = documentManager.get(uri).textDocument;
    const position = doc.positionAt(source.indexOf('█'));
    return {
        textDocument: { uri: uri },
        position: position,
    };
}
function isCompletionList(completions) {
    return completions !== null && !Array.isArray(completions);
}
//# sourceMappingURL=test-helpers.js.map