"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const params_1 = require("../params");
const common_1 = require("./common");
class ObjectCompletionProvider {
    constructor(typeSystem) {
        this.typeSystem = typeSystem;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { partialAst, node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        if (!node || node.type !== liquid_html_parser_1.NodeTypes.VariableLookup) {
            return [];
        }
        if (!node.name || node.lookups.length > 0) {
            // We only do top level in this one.
            return [];
        }
        // ContentFor and Render uses VariableLookup to support completion of NamedParams.
        if ((parentNode === null || parentNode === void 0 ? void 0 : parentNode.type) === liquid_html_parser_1.NodeTypes.ContentForMarkup ||
            (parentNode === null || parentNode === void 0 ? void 0 : parentNode.type) === liquid_html_parser_1.NodeTypes.RenderMarkup) {
            return [];
        }
        const partial = node.name.replace(params_1.CURSOR, '');
        const options = await this.typeSystem.availableVariables(partialAst, partial, node, params.textDocument.uri);
        return options.map(({ entry, type }) => (0, common_1.createCompletionItem)(entry, { kind: vscode_languageserver_1.CompletionItemKind.Variable }, 'object', type));
    }
}
exports.ObjectCompletionProvider = ObjectCompletionProvider;
//# sourceMappingURL=ObjectCompletionProvider.js.map