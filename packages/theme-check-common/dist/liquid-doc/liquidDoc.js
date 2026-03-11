"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasLiquidDoc = hasLiquidDoc;
exports.extractDocDefinition = extractDocDefinition;
const visitor_1 = require("../visitor");
function hasLiquidDoc(snippet) {
    let foundDocTag = false;
    (0, visitor_1.visit)(snippet, {
        LiquidRawTag(node) {
            if (node.name === 'doc')
                foundDocTag = true;
        },
    });
    return foundDocTag;
}
function extractDocDefinition(uri, ast) {
    let hasDocTag = false;
    const nodes = (0, visitor_1.visit)(ast, {
        LiquidRawTag(node) {
            if (node.name === 'doc')
                hasDocTag = true;
            return undefined;
        },
        LiquidDocParamNode(node) {
            var _a, _b, _c, _d;
            return {
                name: node.paramName.value,
                description: (_b = (_a = node.paramDescription) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : null,
                type: (_d = (_c = node.paramType) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : null,
                required: node.required,
                nodeType: 'param',
            };
        },
        LiquidDocExampleNode(node) {
            return {
                content: handleMultilineIndentation(node.content.value.trim()),
                nodeType: 'example',
            };
        },
        LiquidDocDescriptionNode(node) {
            return {
                content: handleMultilineIndentation(node.content.value.trim()),
                nodeType: 'description',
            };
        },
    });
    if (!hasDocTag)
        return { uri };
    const { parameters, examples, description } = nodes.reduce((acc, node) => {
        if (node.nodeType === 'param') {
            acc.parameters.push(node);
        }
        else if (node.nodeType === 'example') {
            acc.examples.push(node);
        }
        else if (node.nodeType === 'description' && !acc.description) {
            acc.description = node;
        }
        return acc;
    }, {
        parameters: [],
        examples: [],
        description: undefined,
    });
    return {
        uri,
        liquidDoc: {
            ...(parameters.length && { parameters }),
            ...(examples.length && { examples }),
            ...(description && { description }),
        },
    };
}
function handleMultilineIndentation(text) {
    const lines = text.split('\n');
    if (lines.length <= 1)
        return text;
    const nonEmptyLines = lines.slice(1).filter((line) => line.trim().length > 0);
    const indentLengths = nonEmptyLines.map((line) => {
        const match = line.match(/^\s*/);
        return match ? match[0].length : 0;
    });
    if (indentLengths.length === 0)
        return text;
    const minIndent = Math.min(...indentLengths);
    return [
        lines[0],
        ...lines.slice(1).map((line) => {
            if (line.trim().length === 0)
                return line; // Skip empty lines
            return line.slice(minIndent);
        }),
    ].join('\n');
}
//# sourceMappingURL=liquidDoc.js.map