"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterNamedParameterCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const params_1 = require("../params");
const common_1 = require("./common");
class FilterNamedParameterCompletionProvider {
    constructor(themeDocset) {
        this.themeDocset = themeDocset;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { node } = params.completionContext;
        if (!node || node.type !== liquid_html_parser_1.NodeTypes.VariableLookup) {
            return [];
        }
        if (!node.name || node.lookups.length > 0) {
            // We only do top level in this one.
            return [];
        }
        const partial = node.name.replace(params_1.CURSOR, '');
        const currentContext = params.completionContext.ancestors.at(-1);
        if (!currentContext || (currentContext === null || currentContext === void 0 ? void 0 : currentContext.type) !== liquid_html_parser_1.NodeTypes.LiquidFilter) {
            return [];
        }
        const filters = await this.themeDocset.filters();
        const foundFilter = filters.find((f) => f.name === currentContext.name);
        if (!(foundFilter === null || foundFilter === void 0 ? void 0 : foundFilter.parameters)) {
            return [];
        }
        const filteredOptions = foundFilter.parameters.filter((p) => !p.positional && p.name.startsWith(partial));
        return filteredOptions.map(({ description, name, types }) => {
            const { textEdit, format } = this.textEdit(node, params.document, name, types[0]);
            return (0, common_1.createCompletionItem)({
                name,
                description,
            }, {
                kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
                insertTextFormat: format,
                // We want to force these options to appear first in the list given
                // the context that they are being requested in.
                sortText: `1${name}`,
                textEdit,
            }, 'filter', Array.isArray(types) ? types[0] : 'unknown');
        });
    }
    textEdit(node, document, name, type) {
        var _a, _b;
        const remainingText = document.source.slice(node.position.end);
        // Match all the way up to the termination of the parameter which could be
        // another parameter (`,`), filter (`|`), or the end of a liquid statement.
        const match = remainingText.match(/^(.*?)\s*(?=,|\||-?\}\}|-?\%\})|^(.*)$/);
        const offset = match ? match[0].length : remainingText.length;
        const existingParameterOffset = (_b = (_a = remainingText.match(/[^a-zA-Z]/)) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : remainingText.length;
        let start = document.textDocument.positionAt(node.position.start);
        let end = document.textDocument.positionAt(node.position.end + offset);
        let newText = type === 'string' ? `${name}: '$1'` : `${name}: `;
        let format = type === 'string' ? vscode_languageserver_1.InsertTextFormat.Snippet : vscode_languageserver_1.InsertTextFormat.PlainText;
        // If the cursor is inside the parameter or at the end and it's the same
        // value as the one we're offering a completion for then we want to restrict
        // the insert to just the name of the parameter.
        // e.g. `{{ product | image_url: cr█op: 'center' }}` and we're offering `crop`
        if (node.name + remainingText.slice(0, existingParameterOffset) == name) {
            newText = name;
            format = vscode_languageserver_1.InsertTextFormat.PlainText;
            end = document.textDocument.positionAt(node.position.end + existingParameterOffset);
        }
        // If the cursor is at the beginning of the string we can consider all
        // options and should not replace any text.
        // e.g. `{{ product | image_url: █crop: 'center' }}`
        // e.g. `{{ product | image_url: █ }}`
        if (node.name === '█') {
            end = start;
        }
        return {
            textEdit: vscode_languageserver_1.TextEdit.replace({
                start,
                end,
            }, newText),
            format,
        };
    }
}
exports.FilterNamedParameterCompletionProvider = FilterNamedParameterCompletionProvider;
//# sourceMappingURL=FilterNamedParameterCompletionProvider.js.map