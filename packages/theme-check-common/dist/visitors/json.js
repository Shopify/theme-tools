"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visitJSON = visitJSON;
function isJSONNode(thing) {
    return !!thing && typeof thing === 'object' && 'type' in thing;
}
const nonTraversableProperties = new Set(['loc']);
async function visitJSON(node, check) {
    const stack = [{ node, ancestors: [] }];
    let method;
    while (stack.length > 0) {
        const { node, ancestors } = stack.pop();
        const lineage = ancestors.concat(node);
        method = check[node.type];
        if (method)
            await method(node, ancestors);
        for (const key in node) {
            if (!node.hasOwnProperty(key) || nonTraversableProperties.has(key)) {
                continue;
            }
            const value = node[key];
            if (Array.isArray(value)) {
                for (let i = value.length - 1; i >= 0; i--) {
                    const item = value[i];
                    if (isJSONNode(item)) {
                        stack.push({ node: item, ancestors: lineage });
                    }
                }
            }
            else if (isJSONNode(value)) {
                stack.push({ node: value, ancestors: lineage });
            }
        }
        method = check[`${node.type}:exit`];
        if (method)
            await method(node, ancestors);
    }
}
//# sourceMappingURL=json.js.map