"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidDocParamTypeCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_check_common_2 = require("@shopify/theme-check-common");
class LiquidDocParamTypeCompletionProvider {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        if (!(0, theme_check_common_1.filePathSupportsLiquidDoc)(params.document.uri))
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        if (!node ||
            !parentNode ||
            node.type !== liquid_html_parser_1.NodeTypes.TextNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidRawTag ||
            parentNode.name !== 'doc') {
            return [];
        }
        /**
         * We need to make sure we're trying to code complete after
         * the param tag's `{` character.
         *
         * We will be removing any spaces in case there are any formatting issues.
         */
        const fragments = node.value.split(' ').filter(Boolean);
        if (fragments.length > 2 ||
            fragments[0] !== `@${theme_check_common_2.SupportedDocTagTypes.Param}` ||
            !/^\{[a-zA-Z]*$/.test(fragments[1])) {
            return [];
        }
        const liquidDrops = await this.themeDocset.liquidDrops();
        return Array.from((0, theme_check_common_2.getValidParamTypes)(liquidDrops)).map(([label, description]) => {
            const documentation = description
                ? {
                    kind: vscode_languageserver_1.MarkupKind.Markdown,
                    value: description,
                }
                : undefined;
            return {
                label,
                kind: vscode_languageserver_1.CompletionItemKind.EnumMember,
                insertText: label,
                documentation,
            };
        });
    }
}
exports.LiquidDocParamTypeCompletionProvider = LiquidDocParamTypeCompletionProvider;
//# sourceMappingURL=LiquidDocParamTypeCompletionProvider.js.map