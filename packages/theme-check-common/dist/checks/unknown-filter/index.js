"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownFilter = void 0;
// src/checks/unknown-filter/index.ts
const types_1 = require("../../types");
exports.UnknownFilter = {
    meta: {
        code: 'UnknownFilter',
        name: 'Prevent use of unknown filters',
        docs: {
            description: 'This check is aimed at preventing the use of unknown filters.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unknown-filter',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        if (!context.themeDocset) {
            return {};
        }
        return {
            async LiquidFilter(node) {
                const knownFilters = await context.themeDocset.filters();
                if (!knownFilters.some((filter) => filter.name === node.name)) {
                    context.report({
                        message: `Unknown filter '${node.name}' used.`,
                        startIndex: node.position.start + 1,
                        endIndex: node.position.end,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map