"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.location = exports.JSONCParseErrors = void 0;
exports.toJSONNode = toJSONNode;
const utils_1 = require("../utils");
const jsonc_parser_1 = require("jsonc-parser");
class JSONCParseErrors extends Error {
    constructor(message, errors) {
        super(message);
        this.errors = errors;
    }
}
exports.JSONCParseErrors = JSONCParseErrors;
/**
 * At some point, we started supporting JSONC. Theme Check 2 was built on top of
 * `json-to-ast` which does not support comments.
 *
 * This little adapter here will take a tree we get from `jsonc-parser` and
 * convert it to the shape of `json-to-ast`.
 *
 * The `json-to-ast` types feel much better to use than the ones from `jsonc-parser`
 * and we don't need to rewrite all our downstream code.
 */
function toJSONNode(source) {
    const errors = [];
    const tree = (0, jsonc_parser_1.parseTree)(source, errors, {
        allowTrailingComma: true,
        disallowComments: false,
    });
    if (errors.length || tree === undefined) {
        throw new JSONCParseErrors('Failed to parse JSONC', errors);
    }
    return jsoncToJsonAst(tree);
}
function jsoncToJsonAst(node) {
    switch (node.type) {
        case 'object': {
            return objectToObjectNode(node);
        }
        case 'property': {
            return propertyToPropertyNode(node);
        }
        case 'array': {
            return arrayToArrayNode(node);
        }
        case 'boolean':
        case 'null':
        case 'number':
        case 'string': {
            return valueToLiteralNode(node);
        }
        default: {
            (0, utils_1.assertNever)(node.type);
        }
    }
}
function objectToObjectNode(node) {
    var _a;
    return {
        type: 'Object',
        children: ((_a = node.children) !== null && _a !== void 0 ? _a : []).map(jsoncToJsonAst),
        loc: (0, exports.location)(node.offset, node.offset + node.length),
    };
}
function arrayToArrayNode(node) {
    return {
        type: 'Array',
        children: node.children.map(jsoncToJsonAst),
        loc: (0, exports.location)(node.offset, node.offset + node.length),
    };
}
function propertyToPropertyNode(node) {
    return {
        type: 'Property',
        key: identifierToIdentifierNode(node.children[0]),
        value: jsoncToJsonAst(node.children[1]),
        loc: (0, exports.location)(node.offset, node.offset + node.length),
    };
}
function identifierToIdentifierNode(node) {
    return {
        type: 'Identifier',
        value: node.value,
        raw: JSON.stringify(node.value),
        loc: (0, exports.location)(node.offset, node.offset + node.length),
    };
}
function valueToLiteralNode(node) {
    return {
        type: 'Literal',
        value: node.value,
        raw: JSON.stringify(node.value),
        loc: (0, exports.location)(node.offset, node.offset + node.length),
    };
}
const location = (start, end) => ({
    start: position(start),
    end: position(end),
});
exports.location = location;
const position = (offset) => ({ offset });
//# sourceMappingURL=parse.js.map