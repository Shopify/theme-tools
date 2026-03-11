"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportUnknownArguments = reportUnknownArguments;
exports.reportMissingArguments = reportMissingArguments;
exports.reportDuplicateArguments = reportDuplicateArguments;
exports.findTypeMismatchParams = findTypeMismatchParams;
exports.reportTypeMismatches = reportTypeMismatches;
exports.generateTypeMismatchSuggestions = generateTypeMismatchSuggestions;
exports.getBlockName = getBlockName;
exports.getSnippetName = getSnippetName;
exports.getLiquidDocParams = getLiquidDocParams;
exports.makeRemoveArgumentCorrector = makeRemoveArgumentCorrector;
exports.makeAddArgumentCorrector = makeAddArgumentCorrector;
/**
 * Helper methods shared between `render` tag and `content_for` tag to report
 * errors when LiquidDoc exists
 */
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
const utils_2 = require("../checks/utils");
/**
 * Report error when unknown arguments are provided for `content_for` tag or `render` tag
 */
function reportUnknownArguments(context, node, unknownProvidedArgs, name) {
    let errorOwnerMessage = '';
    if (node.type === liquid_html_parser_1.NodeTypes.ContentForMarkup) {
        errorOwnerMessage = ` in content_for tag for static block '${name}'`;
    }
    else if (node.type === liquid_html_parser_1.NodeTypes.RenderMarkup) {
        errorOwnerMessage = ` in render tag for snippet '${name}'`;
    }
    for (const arg of unknownProvidedArgs) {
        context.report({
            message: `Unknown argument '${arg.name}'${errorOwnerMessage}.`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
            suggest: [
                {
                    message: `Remove '${arg.name}'`,
                    fix: makeRemoveArgumentCorrector(node, arg),
                },
            ],
        });
    }
}
/**
 * Report error when missing arguments are provided for `content_for` tag or `render` tag
 */
function reportMissingArguments(context, node, missingRequiredArgs, name) {
    let errorOwnerMessage = '';
    if (node.type === liquid_html_parser_1.NodeTypes.ContentForMarkup) {
        errorOwnerMessage = ` in content_for tag for static block '${name}'`;
    }
    else if (node.type === liquid_html_parser_1.NodeTypes.RenderMarkup) {
        errorOwnerMessage = ` in render tag for snippet '${name}'`;
    }
    for (const arg of missingRequiredArgs) {
        context.report({
            message: `Missing required argument '${arg.name}'${errorOwnerMessage}.`,
            startIndex: node.position.start,
            endIndex: node.position.end,
            suggest: [
                {
                    message: `Add required argument '${arg.name}'`,
                    fix: makeAddArgumentCorrector(node, arg),
                },
            ],
        });
    }
}
function reportDuplicateArguments(context, node, duplicateArgs, name) {
    let errorOwnerMessage = '';
    if (node.type === liquid_html_parser_1.NodeTypes.ContentForMarkup) {
        errorOwnerMessage = ` in content_for tag for static block '${name}'`;
    }
    else if (node.type === liquid_html_parser_1.NodeTypes.RenderMarkup) {
        errorOwnerMessage = ` in render tag for snippet '${name}'`;
    }
    for (const arg of duplicateArgs) {
        context.report({
            message: `Duplicate argument '${arg.name}'${errorOwnerMessage}.`,
            startIndex: arg.position.start,
            endIndex: arg.position.end,
            suggest: [
                {
                    message: `Remove duplicate argument '${arg.name}'`,
                    fix: makeRemoveArgumentCorrector(node, arg),
                },
            ],
        });
    }
}
/**
 * Find type mismatch between the arguments provided for `content_for` tag and `render` tag
 * and their associated file's LiquidDoc
 */
function findTypeMismatchParams(liquidDocParameters, providedParams) {
    const typeMismatchParams = [];
    for (const arg of providedParams) {
        if (arg.value.type === liquid_html_parser_1.NodeTypes.VariableLookup) {
            continue;
        }
        const liquidDocParamDef = liquidDocParameters.get(arg.name);
        if (liquidDocParamDef && liquidDocParamDef.type) {
            const paramType = liquidDocParamDef.type.toLowerCase();
            const supportedTypes = Object.keys(utils_1.BasicParamTypes).map((type) => type.toLowerCase());
            if (!supportedTypes.includes(paramType)) {
                continue;
            }
            if (!(0, utils_1.isTypeCompatible)(paramType, (0, utils_1.inferArgumentType)(arg.value))) {
                typeMismatchParams.push(arg);
            }
        }
    }
    return typeMismatchParams;
}
/**
 * Report error if the type mismatches between LiquidDoc and provided arguments
 */
function reportTypeMismatches(context, typeMismatchArgs, liquidDocParameters) {
    for (const arg of typeMismatchArgs) {
        const paramDef = liquidDocParameters.get(arg.name);
        if (!paramDef || !paramDef.type)
            continue;
        const expectedType = paramDef.type.toLowerCase();
        const actualType = (0, utils_1.inferArgumentType)(arg.value);
        const suggestions = generateTypeMismatchSuggestions(expectedType, arg.value.position.start, arg.value.position.end);
        context.report({
            message: `Type mismatch for argument '${arg.name}': expected ${expectedType}, got ${actualType}`,
            startIndex: arg.value.position.start,
            endIndex: arg.value.position.end,
            suggest: suggestions,
        });
    }
}
/**
 * Generates suggestions for type mismatches based on the expected type and node positions
 */
function generateTypeMismatchSuggestions(expectedType, startPosition, endPosition) {
    const defaultValue = (0, utils_1.getDefaultValueForType)(expectedType);
    const suggestions = [];
    // Only add the "replace with default" suggestion if the default is not an empty string
    if (defaultValue !== '') {
        suggestions.push({
            message: `Replace with default value '${defaultValue}' for ${expectedType}`,
            fix: (fixer) => {
                return fixer.replace(startPosition, endPosition, defaultValue);
            },
        });
    }
    // Always include the "remove value" suggestion
    suggestions.push({
        message: `Remove value`,
        fix: (fixer) => {
            return fixer.remove(startPosition, endPosition);
        },
    });
    return suggestions;
}
function isLastArg(node, arg) {
    return (node.args.length == 1 || arg.position.start == node.args[node.args.length - 1].position.start);
}
function getBlockName(node) {
    var _a;
    if (node.contentForType.value !== 'block') {
        return;
    }
    const contentForTypeArg = (_a = node.args.find((arg) => arg.name == 'type')) === null || _a === void 0 ? void 0 : _a.value;
    if (!contentForTypeArg || !(0, utils_2.isLiquidString)(contentForTypeArg)) {
        return;
    }
    return contentForTypeArg.value;
}
function getSnippetName(node) {
    if (!(0, utils_2.isLiquidString)(node.snippet)) {
        return;
    }
    return node.snippet.value;
}
async function getLiquidDocParams(context, relativePath) {
    var _a;
    const docDefinition = context.getDocDefinition && (await context.getDocDefinition(relativePath));
    if (!((_a = docDefinition === null || docDefinition === void 0 ? void 0 : docDefinition.liquidDoc) === null || _a === void 0 ? void 0 : _a.parameters)) {
        return;
    }
    return new Map(docDefinition.liquidDoc.parameters.map((p) => [p.name, p]));
}
function makeRemoveArgumentCorrector(node, arg) {
    return (fixer) => {
        const sourceBeforeArg = node.source.slice(node.position.start, arg.position.start);
        const matches = sourceBeforeArg.match(/,\s*/g);
        const lastCommaMatch = matches === null || matches === void 0 ? void 0 : matches[matches.length - 1];
        let startPos = lastCommaMatch
            ? arg.position.start - (lastCommaMatch.length - 1)
            : arg.position.start;
        if (isLastArg(node, arg)) {
            // Remove the leading comma if it's the last parameter
            startPos -= 1;
        }
        const sourceAfterArg = node.source.substring(arg.position.end, node.position.end);
        const trailingCommaMatch = sourceAfterArg.match(/\s*,/);
        if (trailingCommaMatch) {
            return fixer.remove(startPos, arg.position.end + trailingCommaMatch[0].length);
        }
        return fixer.remove(startPos, arg.position.end);
    };
}
function makeAddArgumentCorrector(node, arg) {
    return (fixer) => {
        const paramToAdd = `, ${arg.name}: ${(0, utils_1.getDefaultValueForType)(arg.type)}`;
        if (node.args.length == 0) {
            return fixer.insert(node.position.end - 1, paramToAdd);
        }
        const lastArg = node.args[node.args.length - 1];
        const sourceAfterLastArg = node.source.substring(lastArg.position.end, node.position.end);
        const trailingCommaAndWhitespaceMatch = sourceAfterLastArg.match(/\s*,\s*/);
        if (trailingCommaAndWhitespaceMatch) {
            // IF there is already a trailing comma after the last arg, we want to find it and replace it with our own while stripping whitespace
            return fixer.replace(lastArg.position.end, lastArg.position.end + trailingCommaAndWhitespaceMatch[0].length, `${paramToAdd} `);
        }
        return fixer.insert(lastArg.position.end, paramToAdd);
    };
}
//# sourceMappingURL=arguments.js.map