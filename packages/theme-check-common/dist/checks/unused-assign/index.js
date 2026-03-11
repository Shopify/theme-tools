"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnusedAssign = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../utils");
exports.UnusedAssign = {
    meta: {
        code: 'UnusedAssign',
        name: 'Prevent unused assigns',
        docs: {
            description: 'This check exists to prevent bloat in themes by surfacing variable definitions that are not used.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-assign',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        const assignedVariables = new Map();
        const usedVariables = new Set();
        function checkVariableUsage(node) {
            if (node.type === liquid_html_parser_1.NodeTypes.VariableLookup) {
                usedVariables.add(node.name);
            }
        }
        return {
            async LiquidTag(node, ancestors) {
                if ((0, utils_1.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                    return;
                if (isLiquidTagAssign(node)) {
                    assignedVariables.set(node.markup.name, node);
                }
                else if (isLiquidTagCapture(node) && node.markup.name) {
                    assignedVariables.set(node.markup.name, node);
                }
            },
            async VariableLookup(node, ancestors) {
                if ((0, utils_1.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                    return;
                const parentNode = ancestors.at(-1);
                if (parentNode && isLiquidTagCapture(parentNode)) {
                    return;
                }
                checkVariableUsage(node);
            },
            async onCodePathEnd() {
                for (const [variable, node] of assignedVariables.entries()) {
                    if (!usedVariables.has(variable) && !variable.startsWith('_')) {
                        context.report({
                            message: `The variable '${variable}' is assigned but not used`,
                            startIndex: isLiquidTagCapture(node)
                                ? node.blockStartPosition.start
                                : node.position.start,
                            endIndex: isLiquidTagCapture(node) ? node.blockStartPosition.end : node.position.end,
                            suggest: [
                                {
                                    message: `Remove the unused variable '${variable}'`,
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
function isLiquidTagAssign(node) {
    return node.name === 'assign' && typeof node.markup !== 'string';
}
function isLiquidTagCapture(node) {
    return (node.type == liquid_html_parser_1.NodeTypes.LiquidTag && node.name === 'capture' && typeof node.markup !== 'string');
}
//# sourceMappingURL=index.js.map