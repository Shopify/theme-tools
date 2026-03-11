"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportedDocTagTypes = exports.BasicParamTypes = void 0;
exports.getDefaultValueForType = getDefaultValueForType;
exports.inferArgumentType = inferArgumentType;
exports.isTypeCompatible = isTypeCompatible;
exports.filePathSupportsLiquidDoc = filePathSupportsLiquidDoc;
exports.getValidParamTypes = getValidParamTypes;
exports.parseParamType = parseParamType;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("../utils");
const to_schema_1 = require("../to-schema");
const to_schema_2 = require("../to-schema");
/**
 * The base set of supported param types for LiquidDoc.
 *
 * This is used in conjunction with objects defined in [liquid docs](https://shopify.dev/docs/api/liquid/objects)
 * to determine ALL supported param types for LiquidDoc.
 *
 * References `getValidParamTypes`
 */
var BasicParamTypes;
(function (BasicParamTypes) {
    BasicParamTypes["String"] = "string";
    BasicParamTypes["Number"] = "number";
    BasicParamTypes["Boolean"] = "boolean";
    BasicParamTypes["Object"] = "object";
})(BasicParamTypes || (exports.BasicParamTypes = BasicParamTypes = {}));
var SupportedDocTagTypes;
(function (SupportedDocTagTypes) {
    SupportedDocTagTypes["Param"] = "param";
    SupportedDocTagTypes["Example"] = "example";
    SupportedDocTagTypes["Description"] = "description";
})(SupportedDocTagTypes || (exports.SupportedDocTagTypes = SupportedDocTagTypes = {}));
/**
 * Provides a default completion value for an argument / parameter of a given type.
 */
function getDefaultValueForType(type) {
    switch (type === null || type === void 0 ? void 0 : type.toLowerCase()) {
        case BasicParamTypes.String:
            return "''";
        case BasicParamTypes.Number:
            return '0';
        case BasicParamTypes.Boolean:
            return 'false';
        case BasicParamTypes.Object: // Objects don't have a sensible default value (maybe `theme`?)
        default:
            return '';
    }
}
/**
 * Casts the value of a LiquidNamedArgument to a string representing the type of the value.
 */
function inferArgumentType(arg) {
    switch (arg.type) {
        case liquid_html_parser_1.NodeTypes.String:
            return BasicParamTypes.String;
        case liquid_html_parser_1.NodeTypes.Number:
            return BasicParamTypes.Number;
        case liquid_html_parser_1.NodeTypes.LiquidLiteral:
            return BasicParamTypes.Boolean;
        case liquid_html_parser_1.NodeTypes.Range:
        case liquid_html_parser_1.NodeTypes.VariableLookup:
            return BasicParamTypes.Object;
        default:
            // This ensures that we have a case for every possible type for arg.value
            return (0, utils_1.assertNever)(arg);
    }
}
/**
 * Checks if the provided argument type is compatible with the expected type.
 * Makes certain types more permissive:
 * - Boolean accepts any value, since everything is truthy / falsy in Liquid
 */
function isTypeCompatible(expectedType, actualType) {
    const normalizedExpectedType = expectedType.toLowerCase();
    if (normalizedExpectedType === BasicParamTypes.Boolean) {
        return true;
    }
    return normalizedExpectedType === actualType;
}
/**
 * Checks if the provided file path supports the LiquidDoc tag.
 */
function filePathSupportsLiquidDoc(uri) {
    return (0, to_schema_1.isSnippet)(uri) || (0, to_schema_2.isBlock)(uri);
}
/**
 * Dynamically generates a map of LiquidDoc param types using object entries from
 * [liquid docs](https://shopify.dev/docs/api/liquid/objects).
 *
 * This is used in conjunction with the base set of supported param.
 *
 * References `BasicParamTypes`
 */
function getValidParamTypes(objectEntries) {
    const paramTypes = new Map([
        [BasicParamTypes.String, undefined],
        [BasicParamTypes.Number, undefined],
        [BasicParamTypes.Boolean, undefined],
        [
            BasicParamTypes.Object,
            'A generic type used to represent any liquid object or primitive value.',
        ],
    ]);
    objectEntries.forEach((obj) => paramTypes.set(obj.name, obj.summary || obj.description));
    return paramTypes;
}
function parseParamType(validParamTypes, value) {
    const paramTypeMatch = value.match(/^([a-z_]+)(\[\])?$/);
    if (!paramTypeMatch)
        return undefined;
    const extractedParamType = paramTypeMatch[1];
    const isArrayType = !!paramTypeMatch[2];
    if (!validParamTypes.has(extractedParamType))
        return undefined;
    return [extractedParamType, isArrayType];
}
//# sourceMappingURL=utils.js.map