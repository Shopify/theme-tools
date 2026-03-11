"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visit = visit;
exports.forEachChildNodes = forEachChildNodes;
exports.findCurrentNode = findCurrentNode;
exports.findJSONNode = findJSONNode;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
function isNode(x) {
    return x !== null && typeof x === 'object' && typeof x.type === 'string';
}
/**
 * @example
 *
 * const links = visit<'LiquidHTML', DocumentLink>(liquidAST, {
 *   'LiquidTag': (node, ancestors) => {
 *     if (node.name === 'render' || node.name === 'include') {
 *       return DocumentLink.create(...);
 *     }
 *   },
 * })
 *
 * Note: this is the ChatGPT-rewritten version of the recursive method.
 * If you want to refactor it, just ask it to do it for you :P
 */
function visit(node, visitor) {
    const results = [];
    const stack = [{ node, lineage: [] }];
    const pushStack = (node, lineage) => stack.push({ node, lineage });
    while (stack.length > 0) {
        // Visit current node
        const { node, lineage } = stack.pop();
        const visitNode = visitor[node.type];
        const result = visitNode ? visitNode(node, lineage) : undefined;
        if (Array.isArray(result)) {
            results.push(...result);
        }
        else if (result !== undefined) {
            results.push(result);
        }
        // Enqueue child nodes
        forEachChildNodes(node, lineage.concat(node), pushStack);
    }
    return results;
}
function forEachChildNodes(node, lineage, execute) {
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) {
                execute(value[i], lineage);
            }
        }
        else if (isNode(value)) {
            execute(value, lineage);
        }
    }
}
function findCurrentNode(ast, cursorPosition) {
    let prev;
    let current = ast;
    let ancestors = [];
    while (current !== prev) {
        prev = current;
        forEachChildNodes(current, ancestors.concat(current), (child, lineage) => {
            if (isUnclosed(child) ||
                (isCovered(child, cursorPosition) && size(child) <= size(current))) {
                current = child;
                ancestors = lineage;
            }
        });
    }
    return [current, ancestors];
}
function isCovered(node, offset) {
    switch (node.type) {
        // `product.█title` should cover `title`
        case liquid_html_parser_1.NodeTypes.String:
        // `if █cond` should cover `cond`
        case liquid_html_parser_1.NodeTypes.VariableLookup:
        // `if █cond and other` should cover `cond`
        case liquid_html_parser_1.NodeTypes.LogicalExpression:
        // `if █cond < other` should cover `cond`
        case liquid_html_parser_1.NodeTypes.Comparison:
            return node.position.start <= offset && offset <= node.position.end;
        // default case avoids ambiguity by having the cursor in the [excluded, included] range
        default:
            return node.position.start < offset && offset <= node.position.end;
    }
}
function size(node) {
    return node.position.end - node.position.start;
}
function isUnclosed(node) {
    var _a;
    if ('blockEndPosition' in node) {
        return ((_a = node.blockEndPosition) === null || _a === void 0 ? void 0 : _a.end) === -1;
    }
    else if ('children' in node) {
        return node.children.length > 0;
    }
    return false;
}
function findJSONNode(ast, cursorPosition) {
    let prev;
    let current = ast;
    let ancestors = [];
    const offset = cursorPosition;
    while (current !== prev) {
        prev = current;
        forEachChildNodes(current, ancestors.concat(current), (child, lineage) => {
            if (child.loc.start.offset <= offset && offset < child.loc.end.offset) {
                current = child;
                ancestors = lineage;
            }
        });
    }
    return [current, ancestors];
}
//# sourceMappingURL=visitor.js.map