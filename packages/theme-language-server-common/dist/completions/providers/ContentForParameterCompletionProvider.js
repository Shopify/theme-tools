"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentForParameterCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const params_1 = require("../params");
const contentForParameterCompletionOptions_1 = require("./data/contentForParameterCompletionOptions");
const liquidDoc_1 = require("../../utils/liquidDoc");
/**
 * Offers completions for parameters for the `content_for` tag after a user has
 * specificied the type.
 *
 * @example {% content_for "block", █ %}
 */
class ContentForParameterCompletionProvider {
    constructor(getDocDefinitionForURI) {
        this.getDocDefinitionForURI = getDocDefinitionForURI;
    }
    async completions(params) {
        var _a;
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        const parentIsContentFor = (parentNode === null || parentNode === void 0 ? void 0 : parentNode.type) == liquid_html_parser_1.NodeTypes.ContentForMarkup;
        const nodeIsVariableLookup = (node === null || node === void 0 ? void 0 : node.type) == liquid_html_parser_1.NodeTypes.VariableLookup;
        if (!parentIsContentFor || !nodeIsVariableLookup) {
            return [];
        }
        if (!node.name || node.lookups.length > 0) {
            return [];
        }
        const completionItems = this.staticCompletions(node, parentNode.contentForType.value == 'blocks', params.document);
        if (parentNode.contentForType.value === 'block') {
            const typeArg = (_a = parentNode.args.find((arg) => arg.name === 'type')) === null || _a === void 0 ? void 0 : _a.value;
            if ((typeArg === null || typeArg === void 0 ? void 0 : typeArg.type) === liquid_html_parser_1.NodeTypes.String) {
                const snippetDefinition = await this.getDocDefinitionForURI(params.textDocument.uri, 'blocks', typeArg.value);
                completionItems.push(...this.liquidDocParameterCompletions(node, params.document, snippetDefinition));
            }
        }
        // We need to find out existing params in the content_for tag so we don't offer it again for completion
        const existingParams = parentNode.args
            .filter((arg) => arg.type === liquid_html_parser_1.NodeTypes.NamedArgument)
            .map((arg) => arg.name);
        return completionItems.filter((item) => !existingParams.includes(item.label));
    }
    textEdit(node, document, name, textTemplate = `${name}: '$1'`) {
        var _a, _b;
        const remainingText = document.source.slice(node.position.end);
        // Match all the way up to the termination of the parameter which could be
        // another parameter (`,`), filter (`|`), or the end of a liquid statement.
        const match = remainingText.match(/^(.*?)\s*(?=,|\||-?\}\}|-?\%\})|^(.*)$/);
        const offset = match ? match[0].trimEnd().length : remainingText.length;
        const existingParameterOffset = (_b = (_a = remainingText.match(/[^a-zA-Z]/)) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : remainingText.length;
        let start = document.textDocument.positionAt(node.position.start);
        let end = document.textDocument.positionAt(node.position.end + offset);
        let newText = name === 'closest' ? `${name}.` : textTemplate;
        let format = name === 'closest' ? vscode_languageserver_1.InsertTextFormat.PlainText : vscode_languageserver_1.InsertTextFormat.Snippet;
        // If the cursor is inside the parameter or at the end and it's the same
        // value as the one we're offering a completion for then we want to restrict
        // the insert to just the name of the parameter.
        // e.g. `{% content_for "block", t█ype: "button" %}` and we're offering `type`
        if (node.name + remainingText.slice(0, existingParameterOffset) == name) {
            newText = name;
            format = vscode_languageserver_1.InsertTextFormat.PlainText;
            end = document.textDocument.positionAt(node.position.end + existingParameterOffset);
        }
        // If the cursor is at the beginning of the string we can consider all
        // options and should not replace any text.
        // e.g. `{% content_for "block", █type: "button" %}`
        // e.g. `{% content_for "block", █ %}`
        if (node.name === params_1.CURSOR) {
            end = start;
            // If we're inserting text in front of an existing parameter then we need
            // to add a comma to separate them.
            if (existingParameterOffset > 0) {
                newText += ', ';
            }
        }
        return {
            textEdit: vscode_languageserver_1.TextEdit.replace({
                start,
                end,
            }, newText),
            format,
        };
    }
    staticCompletions(node, isTypeBlocks, document) {
        let options = contentForParameterCompletionOptions_1.DEFAULT_COMPLETION_OPTIONS;
        const partial = node.name.replace(params_1.CURSOR, '');
        if (isTypeBlocks) {
            options = {
                closest: contentForParameterCompletionOptions_1.DEFAULT_COMPLETION_OPTIONS.closest,
            };
        }
        return Object.entries(options)
            .filter(([keyword, _description]) => keyword.startsWith(partial))
            .map(([keyword, description]) => {
            const { textEdit, format } = this.textEdit(node, document, keyword);
            return {
                label: keyword,
                kind: vscode_languageserver_1.CompletionItemKind.Keyword,
                documentation: {
                    kind: 'markdown',
                    value: description,
                },
                insertTextFormat: format,
                textEdit,
            };
        });
    }
    liquidDocParameterCompletions(node, document, docDefinition) {
        var _a;
        return (((_a = docDefinition === null || docDefinition === void 0 ? void 0 : docDefinition.liquidDoc) === null || _a === void 0 ? void 0 : _a.parameters) || []).map((liquidDocParam) => {
            const { textEdit, format } = this.textEdit(node, document, liquidDocParam.name, (0, liquidDoc_1.getParameterCompletionTemplate)(liquidDocParam.name, liquidDocParam.type));
            return {
                label: liquidDocParam.name,
                kind: vscode_languageserver_1.CompletionItemKind.Keyword,
                documentation: {
                    kind: 'markdown',
                    value: liquidDocParam.description || '',
                },
                insertTextFormat: format,
                textEdit,
            };
        });
    }
}
exports.ContentForParameterCompletionProvider = ContentForParameterCompletionProvider;
//# sourceMappingURL=ContentForParameterCompletionProvider.js.map