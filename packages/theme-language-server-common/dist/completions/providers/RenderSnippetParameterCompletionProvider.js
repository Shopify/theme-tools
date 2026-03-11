"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderSnippetParameterCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const params_1 = require("../params");
const liquidDoc_1 = require("../../utils/liquidDoc");
class RenderSnippetParameterCompletionProvider {
    constructor(getDocDefinitionForURI) {
        this.getDocDefinitionForURI = getDocDefinitionForURI;
    }
    async completions(params) {
        var _a, _b;
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        if (!node ||
            !parentNode ||
            node.type !== liquid_html_parser_1.NodeTypes.VariableLookup ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.RenderMarkup ||
            parentNode.snippet.type !== 'String') {
            return [];
        }
        const userInputStr = ((_a = node.name) === null || _a === void 0 ? void 0 : _a.replace(params_1.CURSOR, '')) || '';
        const snippetDefinition = await this.getDocDefinitionForURI(params.textDocument.uri, 'snippets', parentNode.snippet.value);
        const liquidDocParams = (_b = snippetDefinition === null || snippetDefinition === void 0 ? void 0 : snippetDefinition.liquidDoc) === null || _b === void 0 ? void 0 : _b.parameters;
        if (!liquidDocParams) {
            return [];
        }
        let offset = node.name === params_1.CURSOR ? 1 : 0;
        let start = params.document.textDocument.positionAt(node.position.start);
        let end = params.document.textDocument.positionAt(node.position.end - offset);
        // We need to find out existing params in the render tag so we don't offer it again for completion
        const existingRenderParams = parentNode.args
            .filter((arg) => arg.type === liquid_html_parser_1.NodeTypes.NamedArgument)
            .map((arg) => arg.name);
        return liquidDocParams
            .filter((liquidDocParam) => !existingRenderParams.includes(liquidDocParam.name))
            .filter((liquidDocParam) => liquidDocParam.name.startsWith(userInputStr))
            .map((liquidDocParam) => {
            return {
                label: liquidDocParam.name,
                kind: vscode_languageserver_1.CompletionItemKind.Property,
                documentation: {
                    kind: vscode_languageserver_1.MarkupKind.Markdown,
                    value: (0, liquidDoc_1.formatLiquidDocParameter)(liquidDocParam, true),
                },
                textEdit: vscode_languageserver_1.TextEdit.replace(vscode_languageserver_1.Range.create(start, end), (0, liquidDoc_1.getParameterCompletionTemplate)(liquidDocParam.name, liquidDocParam.type)),
                insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet,
            };
        });
    }
}
exports.RenderSnippetParameterCompletionProvider = RenderSnippetParameterCompletionProvider;
//# sourceMappingURL=RenderSnippetParameterCompletionProvider.js.map