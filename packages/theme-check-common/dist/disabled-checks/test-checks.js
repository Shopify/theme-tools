"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderMarkup = exports.LiquidFilter = void 0;
const __1 = require("..");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
exports.LiquidFilter = {
    meta: {
        code: 'LiquidFilter',
        name: 'Complains about every LiquidFilter',
        docs: {
            description: 'Complains about every LiquidFilter',
            recommended: true,
        },
        type: __1.SourceCodeType.LiquidHtml,
        severity: __1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            LiquidFilter: async (node) => {
                context.report({
                    message: 'Liquid filter can not be used',
                    startIndex: node.position.start,
                    endIndex: node.position.end,
                });
            },
        };
    },
};
exports.RenderMarkup = {
    meta: {
        code: 'RenderMarkup',
        name: 'Complains about every RenderMarkup',
        docs: {
            description: 'Complains about every RenderMarkup',
            recommended: true,
        },
        type: __1.SourceCodeType.LiquidHtml,
        severity: __1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async RenderMarkup(node) {
                if (node.snippet.type === liquid_html_parser_1.NodeTypes.VariableLookup) {
                    return;
                }
                context.report({
                    message: `'${node.snippet.value}.liquid' can not be rendered`,
                    startIndex: node.snippet.position.start,
                    endIndex: node.snippet.position.end,
                });
            },
        };
    },
};
//# sourceMappingURL=test-checks.js.map