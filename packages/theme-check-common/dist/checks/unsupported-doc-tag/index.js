"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnsupportedDocTag = void 0;
const types_1 = require("../../types");
const utils_1 = require("../../liquid-doc/utils");
exports.UnsupportedDocTag = {
    meta: {
        code: 'UnsupportedDocTag',
        name: 'Prevent unsupported doc tag usage',
        docs: {
            description: 'This check exists to prevent use of `doc` tag outside of snippet file.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unsupported-doc-tag',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        const docTagName = 'doc';
        if ((0, utils_1.filePathSupportsLiquidDoc)(context.file.uri)) {
            return {};
        }
        return {
            async LiquidRawTag(node) {
                if (node.name !== docTagName) {
                    return;
                }
                context.report({
                    message: `The \`${docTagName}\` tag can only be used within a snippet or block.`,
                    startIndex: node.position.start,
                    endIndex: node.position.end,
                    suggest: [
                        {
                            message: `Remove unsupported \`${docTagName}\` tag`,
                            fix: (corrector) => corrector.remove(node.position.start, node.position.end),
                        },
                    ],
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map