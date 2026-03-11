"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJSONDocumentLinksVisitor = createJSONDocumentLinksVisitor;
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_uri_1 = require("vscode-uri");
function createJSONDocumentLinksVisitor(textDocument, root, offset = 0) {
    const visitor = {
        Property(node, ancestors) {
            const origin = jsonPropertyOriginDirectory(ancestors);
            if (!origin)
                return;
            if (!(node.key.value === 'type' &&
                node.value.type === 'Literal' &&
                typeof node.value.value === 'string')) {
                return;
            }
            if (origin === 'blocks' && ['@app', '@theme'].includes(node.value.value)) {
                return;
            }
            return vscode_languageserver_1.DocumentLink.create(range(textDocument, node.value, offset), vscode_uri_1.Utils.resolvePath(root, origin, node.value.value + '.liquid').toString());
        },
    };
    return visitor;
}
function range(textDocument, node, offset) {
    // +1 and -1 to exclude the quotes
    const start = textDocument.positionAt(offset + node.loc.start.offset + 1);
    const end = textDocument.positionAt(offset + node.loc.end.offset - 1);
    return vscode_languageserver_1.Range.create(start, end);
}
function jsonPropertyOriginDirectory(ancestors) {
    for (let i = ancestors.length - 1; i >= 0; i--) {
        const ancestor = ancestors[i];
        if (ancestor.type === 'Property') {
            if (ancestor.key.value === 'blocks') {
                return 'blocks';
            }
            if (ancestor.key.value === 'sections') {
                return 'sections';
            }
        }
    }
    return undefined;
}
//# sourceMappingURL=DocumentLinksProvider.js.map