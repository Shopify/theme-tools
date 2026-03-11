"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateContentForArguments = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
exports.DuplicateContentForArguments = {
    meta: {
        code: 'DuplicateContentForArguments',
        name: 'Duplicate ContentFor Arguments',
        docs: {
            description: 'This check ensures that no duplicate argument names are provided when rendering a static block.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-content-for-arguments',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async ContentForMarkup(node) {
                const blockName = (0, arguments_1.getBlockName)(node);
                if (!blockName)
                    return;
                const encounteredArgNames = new Set();
                const duplicateArgs = [];
                for (const param of node.args) {
                    if (encounteredArgNames.has(param.name)) {
                        duplicateArgs.push(param);
                    }
                    encounteredArgNames.add(param.name);
                }
                (0, arguments_1.reportDuplicateArguments)(context, node, duplicateArgs, blockName);
            },
        };
    },
};
//# sourceMappingURL=index.js.map