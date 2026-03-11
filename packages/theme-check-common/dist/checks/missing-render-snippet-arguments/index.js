"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingRenderSnippetArguments = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
exports.MissingRenderSnippetArguments = {
    meta: {
        code: 'MissingRenderSnippetArguments',
        name: 'Missing Render Snippet Arguments',
        aliases: ['MissingRenderSnippetParams'],
        docs: {
            description: 'This check ensures that all required arguments are provided when rendering a snippet.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-render-snippet-arguments',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async RenderMarkup(node) {
                const snippetName = (0, arguments_1.getSnippetName)(node);
                if (!snippetName)
                    return;
                const liquidDocParameters = await (0, arguments_1.getLiquidDocParams)(context, `snippets/${snippetName}.liquid`);
                if (!liquidDocParameters)
                    return;
                const providedParams = new Map(node.args.map((arg) => [arg.name, arg]));
                const missingRequiredParams = Array.from(liquidDocParameters.values()).filter((p) => { var _a; return p.required && !providedParams.has(p.name) && p.name !== ((_a = node.alias) === null || _a === void 0 ? void 0 : _a.value); });
                (0, arguments_1.reportMissingArguments)(context, node, missingRequiredParams, snippetName);
            },
        };
    },
};
//# sourceMappingURL=index.js.map