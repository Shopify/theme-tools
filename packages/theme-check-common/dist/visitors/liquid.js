"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitLiquid = visitLiquid;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
function isLiquidHtmlNode(thing) {
    return !!thing && typeof thing === 'object' && 'type' in thing;
}
async function visitLiquid(node, check) {
    const stack = [{ node, ancestors: [] }];
    let method;
    while (stack.length > 0) {
        const { node, ancestors } = stack.pop();
        const lineage = ancestors.concat(node);
        method = check[node.type];
        if (method)
            await method(node, ancestors);
        for (const key in node) {
            if (!node.hasOwnProperty(key) || liquid_html_parser_1.nonTraversableProperties.has(key)) {
                continue;
            }
            const value = node[key];
            if (Array.isArray(value)) {
                for (let i = value.length - 1; i >= 0; i--) {
                    const item = value[i];
                    if (isLiquidHtmlNode(item)) {
                        stack.push({ node: item, ancestors: lineage });
                    }
                }
            }
            else if (isLiquidHtmlNode(value)) {
                stack.push({ node: value, ancestors: lineage });
            }
        }
        method = check[`${node.type}:exit`];
        if (method)
            await method(node, ancestors);
    }
}
//# sourceMappingURL=liquid.js.map