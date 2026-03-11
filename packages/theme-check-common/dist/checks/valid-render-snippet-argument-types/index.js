"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidRenderSnippetArgumentTypes = void 0;
const types_1 = require("../../types");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("../../liquid-doc/utils");
const arguments_1 = require("../../liquid-doc/arguments");
exports.ValidRenderSnippetArgumentTypes = {
    meta: {
        code: 'ValidRenderSnippetArgumentTypes',
        name: 'Valid Render Snippet Argument Types',
        aliases: ['ValidRenderSnippetParamTypes'],
        docs: {
            description: 'This check ensures that arguments passed to snippet match the expected types defined in the liquidDoc header if present.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-render-snippet-argument-types',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        /**
         * Checks for type mismatches when alias is used with `for` or `with` syntax.
         * This can be refactored at a later date to share more code with regular named arguments as they are both backed by LiquidExpression nodes.
         *
         * E.g. {% render 'card' with 123 as title %}
         */
        function findAndReportAliasType(node, liquidDocParameters) {
            var _a, _b, _c;
            if (node.alias &&
                ((_a = node.variable) === null || _a === void 0 ? void 0 : _a.name) &&
                node.variable.name.type !== liquid_html_parser_1.NodeTypes.VariableLookup) {
                const paramIsDefinedWithType = (_c = (_b = liquidDocParameters
                    .get(node.alias.value)) === null || _b === void 0 ? void 0 : _b.type) === null || _c === void 0 ? void 0 : _c.toLowerCase();
                if (paramIsDefinedWithType) {
                    const providedParamType = (0, utils_1.inferArgumentType)(node.variable.name);
                    if (!(0, utils_1.isTypeCompatible)(paramIsDefinedWithType, providedParamType)) {
                        const suggestions = (0, arguments_1.generateTypeMismatchSuggestions)(paramIsDefinedWithType, node.variable.name.position.start, node.variable.name.position.end);
                        context.report({
                            message: `Type mismatch for argument '${node.alias.value}': expected ${paramIsDefinedWithType}, got ${providedParamType}`,
                            startIndex: node.variable.name.position.start,
                            endIndex: node.variable.name.position.end,
                            suggest: suggestions,
                        });
                    }
                }
            }
        }
        return {
            async RenderMarkup(node) {
                const snippetName = (0, arguments_1.getSnippetName)(node);
                if (!snippetName)
                    return;
                const liquidDocParameters = await (0, arguments_1.getLiquidDocParams)(context, `snippets/${snippetName}.liquid`);
                if (!liquidDocParameters)
                    return;
                findAndReportAliasType(node, liquidDocParameters);
                const typeMismatchParams = (0, arguments_1.findTypeMismatchParams)(liquidDocParameters, node.args);
                (0, arguments_1.reportTypeMismatches)(context, typeMismatchParams, liquidDocParameters);
            },
        };
    },
};
//# sourceMappingURL=index.js.map