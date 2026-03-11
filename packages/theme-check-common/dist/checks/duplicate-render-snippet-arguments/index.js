"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateRenderSnippetArguments = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
exports.DuplicateRenderSnippetArguments = {
    meta: {
        code: 'DuplicateRenderSnippetArguments',
        name: 'Duplicate Render Snippet Arguments',
        aliases: ['DuplicateRenderSnippetParams'],
        docs: {
            description: 'This check ensures that no duplicate argument names are provided when rendering a snippet.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-render-snippet-arguments',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async RenderMarkup(node) {
                var _a;
                const snippetName = (0, arguments_1.getSnippetName)(node);
                if (!snippetName)
                    return;
                const encounteredArgNames = new Set();
                const duplicateArgs = [];
                if ((_a = node.alias) === null || _a === void 0 ? void 0 : _a.value) {
                    encounteredArgNames.add(node.alias.value);
                }
                for (const param of node.args) {
                    if (encounteredArgNames.has(param.name)) {
                        duplicateArgs.push(param);
                    }
                    encounteredArgNames.add(param.name);
                }
                (0, arguments_1.reportDuplicateArguments)(context, node, duplicateArgs, snippetName);
            },
        };
    },
};
//# sourceMappingURL=index.js.map