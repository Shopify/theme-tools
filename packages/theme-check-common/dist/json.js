"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJSON = parseJSON;
exports.nodeAtPath = nodeAtPath;
exports.getLocStart = getLocStart;
exports.getLocEnd = getLocEnd;
const jsonc_parser_1 = require("jsonc-parser");
const utils_1 = require("./utils");
const PARSE_OPTS = {
    disallowComments: false,
    allowTrailingComma: true,
    allowEmptyContent: false,
};
function parseJSON(source, defaultValue, isStrict) {
    try {
        /**
         * The jsonc-parser is fault-tolerant and typically returns a valid
         * result. However, it also mutates the 'errors' array with any
         * errors it encounters during parsing.
         */
        const errors = [];
        const result = (0, jsonc_parser_1.parse)(source, errors, PARSE_OPTS);
        if (errors.length && isStrict) {
            throw errors[0];
        }
        return result;
    }
    catch (error) {
        if (defaultValue !== undefined)
            return defaultValue;
        return (0, utils_1.asError)(error);
    }
}
/**
 * Given a known path to a property and an ast, returns the AST node at that path.
 *
 * @example
 * const nameNode = nodeAtPath(ast, ['name'])! as LiteralNode;
 * const blocksNode = nodeAtPath(ast, ['blocks'])! as ArrayNode;
 * const someDeepNode = nodeAtPath(ast, ['blocks', 0, 'settings', 'someDeepKey'])! as LiteralNode;
 */
function nodeAtPath(node, path) {
    return path.reduce((acc, key) => {
        if (!acc)
            return;
        switch (acc.type) {
            case 'Object': {
                const property = acc.children.find((child) => child.key.value === key);
                if (!property)
                    return;
                return property.value;
            }
            case 'Array': {
                return acc.children[key];
            }
            case 'Literal': {
                // You're probably going too deep
                return;
            }
            case 'Identifier': {
                // This is for keys, shouldn't get there
                return;
            }
            case 'Property': {
                // This is for keys, shouldn't get there
                return;
            }
        }
    }, node);
}
/** Given a JSONNode, returns the start offset of the node in the source string. */
function getLocStart(node) {
    var _a, _b;
    return (_b = (_a = node.loc) === null || _a === void 0 ? void 0 : _a.start.offset) !== null && _b !== void 0 ? _b : 0;
}
/** Given a JSONNode, returns the end offset of the node in the source string. */
function getLocEnd(node) {
    var _a, _b;
    return (_b = (_a = node.loc) === null || _a === void 0 ? void 0 : _a.end.offset) !== null && _b !== void 0 ? _b : 0;
}
//# sourceMappingURL=json.js.map