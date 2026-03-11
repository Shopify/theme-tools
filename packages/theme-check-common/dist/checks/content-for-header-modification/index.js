"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentForHeaderModification = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../utils");
function isLiquidTagAssign(node) {
    return node.name === 'assign' && typeof node.markup !== 'string';
}
function isLiquidTagCapture(node) {
    return node.name === 'capture' && typeof node.markup !== 'string';
}
function isLiquidTagEcho(node) {
    return node.name === 'echo' && typeof node.markup !== 'string';
}
exports.ContentForHeaderModification = {
    meta: {
        code: 'ContentForHeaderModification',
        name: 'Do not depend on the content of content_for_header',
        docs: {
            description: 'Do not rely on the content of content_for_header as it might change in the future, which could cause your Liquid code behavior to change.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/content-for-header-modification',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        function checkContentForHeader(node, position) {
            if ((0, utils_1.isNodeOfType)(liquid_html_parser_1.NodeTypes.VariableLookup, node) && node.name === 'content_for_header') {
                context.report({
                    message: 'Do not rely on the content of `content_for_header`',
                    startIndex: position.start,
                    endIndex: position.end,
                });
            }
        }
        return {
            async LiquidTag(node) {
                if (isLiquidTagAssign(node)) {
                    checkContentForHeader(node.markup.value.expression, node.position);
                }
                else if (isLiquidTagEcho(node)) {
                    checkContentForHeader(node.markup.expression, node.position);
                }
                else if (isLiquidTagCapture(node) && node.children) {
                    for (const child of node.children) {
                        if (child.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput && typeof child.markup !== 'string') {
                            checkContentForHeader(child.markup.expression, child.position);
                        }
                    }
                }
            },
            async LiquidVariableOutput(node) {
                if (typeof node.markup === 'string')
                    return;
                if (node.markup.filters.length) {
                    checkContentForHeader(node.markup.expression, node.position);
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map