"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnusedDocParam = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../utils");
exports.UnusedDocParam = {
    meta: {
        code: 'UnusedDocParam',
        name: 'Prevent unused doc parameters',
        docs: {
            description: 'This check exists to ensure any parameters defined in the `doc` tag are used within the snippet.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-doc-param',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        const definedLiquidDocParams = new Map();
        const usedVariables = new Set();
        return {
            async LiquidDocParamNode(node) {
                definedLiquidDocParams.set(node.paramName.value, node);
            },
            async VariableLookup(node, ancestors) {
                if (node.type === liquid_html_parser_1.NodeTypes.VariableLookup &&
                    node.name &&
                    !(0, utils_1.isLoopScopedVariable)(node.name, ancestors)) {
                    usedVariables.add(node.name);
                }
            },
            async onCodePathEnd() {
                for (const [variable, node] of definedLiquidDocParams.entries()) {
                    if (!usedVariables.has(variable)) {
                        context.report({
                            message: `The parameter '${variable}' is defined but not used in this file.`,
                            startIndex: node.position.start,
                            endIndex: node.position.end,
                            suggest: [
                                {
                                    message: `Remove unused parameter '${variable}'`,
                                    fix: (corrector) => corrector.remove(node.position.start, node.position.end),
                                },
                            ],
                        });
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map