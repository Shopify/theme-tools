"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileMatch = fileMatch;
exports.isSectionFile = isSectionFile;
exports.isBlockFile = isBlockFile;
exports.isSectionOrBlockFile = isSectionOrBlockFile;
exports.findSchemaNode = findSchemaNode;
const theme_check_common_1 = require("@shopify/theme-check-common");
function fileMatch(uri, patterns) {
    return patterns.some((pattern) => pattern.test(uri));
}
function isSectionFile(uri) {
    return /\/sections\/[^/]*\.liquid$/.test(uri);
}
function isBlockFile(uri) {
    return /\/blocks\/[^/]*\.liquid$/.test(uri);
}
function isSectionOrBlockFile(uri) {
    return isSectionFile(uri) || isBlockFile(uri);
}
function findSchemaNode(ast) {
    const nodes = (0, theme_check_common_1.visit)(ast, {
        LiquidRawTag(node) {
            if (node.name === 'schema') {
                return node;
            }
        },
    });
    return nodes[0];
}
//# sourceMappingURL=utils.js.map