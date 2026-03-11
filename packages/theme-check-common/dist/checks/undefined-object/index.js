"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UndefinedObject = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const liquidDoc_1 = require("../../liquid-doc/liquidDoc");
const utils_2 = require("../utils");
exports.UndefinedObject = {
    meta: {
        code: 'UndefinedObject',
        name: 'Undefined Object',
        docs: {
            description: 'This check exists to identify references to undefined Liquid objects.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/undefined-object',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        const relativePath = context.toRelativePath(context.file.uri);
        const ast = context.file.ast;
        if ((0, utils_1.isError)(ast))
            return {};
        /**
         * Skip this check when a snippet does not have the presence of doc tags.
         */
        if (relativePath.startsWith('snippets/') && !(0, liquidDoc_1.hasLiquidDoc)(ast))
            return {};
        /**
         * Skip this check when definitions for global objects are unavailable.
         */
        if (!context.themeDocset) {
            return {};
        }
        const themeDocset = context.themeDocset;
        const scopedVariables = new Map();
        const fileScopedVariables = new Set();
        const variables = [];
        function indexVariableScope(variableName, scope) {
            var _a;
            if (!variableName)
                return;
            const indexedScope = (_a = scopedVariables.get(variableName)) !== null && _a !== void 0 ? _a : [];
            scopedVariables.set(variableName, indexedScope.concat(scope));
        }
        return {
            async LiquidDocParamNode(node) {
                var _a;
                const paramName = (_a = node.paramName) === null || _a === void 0 ? void 0 : _a.value;
                if (paramName) {
                    fileScopedVariables.add(paramName);
                }
            },
            async LiquidTag(node, ancestors) {
                var _a, _b, _c, _d;
                if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                    return;
                if (isLiquidTagAssign(node)) {
                    indexVariableScope(node.markup.name, {
                        start: node.blockStartPosition.end,
                    });
                }
                if (isLiquidTagCapture(node)) {
                    indexVariableScope(node.markup.name, {
                        start: (_a = node.blockEndPosition) === null || _a === void 0 ? void 0 : _a.end,
                    });
                }
                /**
                 * {% form 'cart', cart %}
                 *   {{ form }}
                 * {% endform %}
                 */
                if (['form', 'paginate'].includes(node.name)) {
                    indexVariableScope(node.name, {
                        start: node.blockStartPosition.end,
                        end: (_b = node.blockEndPosition) === null || _b === void 0 ? void 0 : _b.start,
                    });
                }
                /* {% layout none %} */
                if (node.name === 'layout') {
                    indexVariableScope('none', {
                        start: node.position.start,
                        end: node.position.end,
                    });
                }
                /* {% increment var %} */
                if ((isLiquidTagIncrement(node) || isLiquidTagDecrement(node)) &&
                    node.markup.name !== null) {
                    indexVariableScope(node.markup.name, {
                        start: node.position.start,
                    });
                }
                /**
                 * {% for x in y %}
                 *   {{ forloop }}
                 *   {{ x }}
                 * {% endfor %}
                 */
                if (isLiquidForTag(node) || isLiquidTableRowTag(node)) {
                    indexVariableScope(node.markup.variableName, {
                        start: node.blockStartPosition.end,
                        end: (_c = node.blockEndPosition) === null || _c === void 0 ? void 0 : _c.start,
                    });
                    indexVariableScope(node.name === 'for' ? 'forloop' : 'tablerowloop', {
                        start: node.blockStartPosition.end,
                        end: (_d = node.blockEndPosition) === null || _d === void 0 ? void 0 : _d.start,
                    });
                }
            },
            async VariableLookup(node, ancestors) {
                if ((0, utils_2.isWithinRawTagThatDoesNotParseItsContents)(ancestors))
                    return;
                const parent = (0, utils_1.last)(ancestors);
                if (isLiquidTag(parent) && isLiquidTagCapture(parent))
                    return;
                variables.push(node);
            },
            async onCodePathEnd() {
                const objects = await globalObjects(themeDocset, relativePath, context.file.uri);
                objects.forEach((obj) => fileScopedVariables.add(obj.name));
                variables.forEach((variable) => {
                    if (!variable.name)
                        return;
                    const isVariableDefined = isDefined(variable.name, variable.position, fileScopedVariables, scopedVariables);
                    if (isVariableDefined)
                        return;
                    context.report({
                        message: `Unknown object '${variable.name}' used.`,
                        startIndex: variable.position.start,
                        endIndex: variable.position.end,
                    });
                });
            },
        };
    },
};
async function globalObjects(themeDocset, relativePath, uri) {
    var _a;
    const perURI = uri ? (_a = themeDocset.getObjectsForURI) === null || _a === void 0 ? void 0 : _a.call(themeDocset, uri) : undefined;
    const objects = perURI !== null && perURI !== void 0 ? perURI : (await themeDocset.objects());
    const contextualObjects = getContextualObjects(relativePath);
    const globalObjects = objects.filter(({ access, name }) => {
        return (contextualObjects.includes(name) ||
            !access ||
            access.global === true ||
            access.template.length > 0);
    });
    return globalObjects;
}
function getContextualObjects(relativePath) {
    if (relativePath.startsWith('layout/checkout.liquid')) {
        return [
            'locale',
            'direction',
            'skip_to_content_link',
            'checkout_html_classes',
            'checkout_stylesheets',
            'checkout_scripts',
            'content_for_logo',
            'breadcrumb',
            'order_summary_toggle',
            'content_for_order_summary',
            'alternative_payment_methods',
            'content_for_footer',
            'tracking_code',
        ];
    }
    if (relativePath.startsWith('sections/')) {
        return ['section', 'predictive_search', 'recommendations', 'comment'];
    }
    if (relativePath.startsWith('blocks/')) {
        return ['app', 'section', 'recommendations', 'block'];
    }
    if (relativePath.startsWith('snippets/')) {
        return ['app'];
    }
    return [];
}
function isDefined(variableName, variablePosition, fileScopedVariables, scopedVariables) {
    /**
     * Check if the variable is defined in the file
     */
    if (fileScopedVariables.has(variableName)) {
        return true;
    }
    /**
     * Check if the variable is defined within a specific scope
     */
    const scopes = scopedVariables.get(variableName);
    /**
     * If no specific scopes exist (and it wasn't defined in the file), it's undefined
     */
    if (!scopes) {
        return false;
    }
    /**
     * Check if the variable's usage position falls within any of the defined scopes
     */
    return scopes.some((scope) => isDefinedInScope(variablePosition, scope));
}
function isDefinedInScope(variablePosition, scope) {
    const start = variablePosition.start;
    const isVariableAfterScopeStart = !scope.start || start > scope.start;
    const isVariableBeforeScopeEnd = !scope.end || start < scope.end;
    return isVariableAfterScopeStart && isVariableBeforeScopeEnd;
}
function isLiquidTag(node) {
    return (node === null || node === void 0 ? void 0 : node.type) === liquid_html_parser_1.NodeTypes.LiquidTag;
}
function isLiquidTagCapture(node) {
    return node.name === liquid_html_parser_1.NamedTags.capture;
}
function isLiquidTagAssign(node) {
    return node.name === liquid_html_parser_1.NamedTags.assign && typeof node.markup !== 'string';
}
function isLiquidForTag(node) {
    return node.name === liquid_html_parser_1.NamedTags.for && typeof node.markup !== 'string';
}
function isLiquidTableRowTag(node) {
    return node.name === liquid_html_parser_1.NamedTags.tablerow && typeof node.markup !== 'string';
}
function isLiquidTagIncrement(node) {
    return node.name === liquid_html_parser_1.NamedTags.increment && typeof node.markup !== 'string';
}
function isLiquidTagDecrement(node) {
    return node.name === liquid_html_parser_1.NamedTags.decrement && typeof node.markup !== 'string';
}
//# sourceMappingURL=index.js.map