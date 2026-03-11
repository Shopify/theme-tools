"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnrecognizedRenderSnippetArguments = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
exports.UnrecognizedRenderSnippetArguments = {
    meta: {
        code: 'UnrecognizedRenderSnippetArguments',
        name: 'Unrecognized Render Snippet Arguments',
        aliases: ['UnrecognizedRenderSnippetParams'],
        docs: {
            description: 'This check ensures that no unknown arguments are used when rendering a snippet.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-render-snippet-arguments',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        function reportUnknownAliases(node, liquidDocParameters, snippetName) {
            const alias = node.alias;
            const variable = node.variable;
            if (alias && !liquidDocParameters.has(alias.value) && variable) {
                const startIndex = variable.position.start + 1;
                context.report({
                    message: `Unknown argument '${alias.value}' in render tag for snippet '${snippetName}'.`,
                    startIndex: startIndex,
                    endIndex: alias.position.end,
                    suggest: [
                        {
                            message: `Remove '${alias.value}'`,
                            fix: (fixer) => {
                                if (variable) {
                                    return fixer.remove(variable.position.start, alias.position.end);
                                }
                            },
                        },
                    ],
                });
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
                const unknownProvidedParams = node.args.filter((p) => !liquidDocParameters.has(p.name));
                reportUnknownAliases(node, liquidDocParameters, snippetName);
                (0, arguments_1.reportUnknownArguments)(context, node, unknownProvidedParams, snippetName);
            },
        };
    },
};
//# sourceMappingURL=index.js.map