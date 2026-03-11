"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueDocParamNames = void 0;
const types_1 = require("../../types");
exports.UniqueDocParamNames = {
    meta: {
        code: 'UniqueDocParamNames',
        name: 'Unique doc parameter names',
        docs: {
            description: 'This check exists to ensure any parameter names defined in the `doc` tag are unique.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unique-doc-param-names',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        const definedLiquidDocParamNames = new Set();
        return {
            async LiquidDocParamNode(node) {
                const paramName = node.paramName.value;
                if (!definedLiquidDocParamNames.has(paramName)) {
                    definedLiquidDocParamNames.add(paramName);
                    return;
                }
                context.report({
                    message: `The parameter '${paramName}' is defined more than once.`,
                    startIndex: node.paramName.position.start,
                    endIndex: node.paramName.position.end,
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map