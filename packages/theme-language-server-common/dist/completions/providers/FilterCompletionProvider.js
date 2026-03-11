"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const TypeSystem_1 = require("../../TypeSystem");
const utils_1 = require("../../utils");
const params_1 = require("../params");
const common_1 = require("./common");
class FilterCompletionProvider {
    constructor(typeSystem) {
        this.typeSystem = typeSystem;
        this.options = (0, utils_1.memoize)(async (inputType) => {
            const filterEntries = await this.typeSystem.filterEntries();
            const options = filterEntries
                .filter((entry) => { var _a; return (_a = entry.syntax) === null || _a === void 0 ? void 0 : _a.startsWith(inputType); })
                .sort(common_1.sortByName);
            // Case we take "anything" as argument
            if (inputType === 'variable') {
                const entriesWithoutSyntax = filterEntries.filter((entry) => !entry.syntax);
                return options.concat(entriesWithoutSyntax).sort(common_1.sortByName);
            }
            // Case there doesn't exist filter entries for that type
            if (options.length === 0) {
                return filterEntries.sort(common_1.sortByName);
            }
            const untypedOptions = await this.options('variable');
            // We show 'array' options before 'untyped' options because they feel
            // like better options.
            return [...options, ...untypedOptions.map(deprioritized)];
        }, (inputType) => inputType);
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { partialAst, node, ancestors } = params.completionContext;
        if (!node || node.type !== liquid_html_parser_1.NodeTypes.LiquidFilter) {
            return [];
        }
        if (node.args.length > 0) {
            // We only do name completion
            return [];
        }
        // We'll fake a LiquidVariable
        let parentVariable = ancestors.at(-1);
        if (!parentVariable ||
            parentVariable.type !== liquid_html_parser_1.NodeTypes.LiquidVariable ||
            parentVariable.filters.at(-1) !== node) {
            return []; // something went wrong...
        }
        // We'll infer the type of the variable up to the last filter (excluding this one)
        parentVariable = { ...parentVariable }; // soft clone
        parentVariable.filters = parentVariable.filters.slice(0, -1); // remove last one
        const inputType = await this.typeSystem.inferType(parentVariable, partialAst, params.textDocument.uri);
        const partial = node.name.replace(params_1.CURSOR, '');
        const options = await this.options((0, TypeSystem_1.isArrayType)(inputType) ? 'array' : inputType);
        return options
            .filter(({ name }) => name.startsWith(partial))
            .map((entry) => {
            const { textEdit, format } = this.textEdit(node, params.document, entry);
            return (0, common_1.createCompletionItem)(entry, {
                kind: vscode_languageserver_1.CompletionItemKind.Function,
                insertTextFormat: format,
                textEdit,
            }, 'filter');
        });
    }
    textEdit(node, document, entry) {
        var _a, _b;
        const remainingText = document.source.slice(node.position.end);
        // Match all the way up to the termination of the filter which could be
        // another filter (`|`), or the end of a liquid statement.
        const matchEndOfFilter = remainingText.match(/^(.*?)\s*(?=\||-?\}\}|-?\%\})|^(.*)$/);
        const endOffset = matchEndOfFilter ? matchEndOfFilter[1].length : remainingText.length;
        // The start position for a LiquidFilter node includes the `|`. We need to
        // ignore the pipe and any spaces for our starting position.
        const pipeRegex = new RegExp(`(\\s*\\|\\s*)(?:${node.name}(?:\\}|\\%)\\})`);
        const matchFilterPipe = node.source.match(pipeRegex);
        const startOffet = matchFilterPipe ? matchFilterPipe[1].length : 0;
        let start = document.textDocument.positionAt(node.position.start + startOffet);
        let end = document.textDocument.positionAt(node.position.end + endOffset);
        const { insertText, insertStyle } = appendRequiredParemeters(entry);
        let newText = insertText;
        let format = insertStyle;
        // If the cursor is inside the filter or at the end and it's the same
        // value as the one we're offering a completion for then we want to restrict
        // the insert to just the name of the filter.
        // e.g. `{{ product | imag█e_url: crop: 'center' }}` and we're offering `imag█e_url`
        const existingFilterOffset = (_b = (_a = remainingText.match(/[^a-zA-Z_]/)) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : remainingText.length;
        if (node.name + remainingText.slice(0, existingFilterOffset) === entry.name) {
            newText = entry.name;
            format = vscode_languageserver_1.InsertTextFormat.PlainText;
            end = document.textDocument.positionAt(node.position.end + existingFilterOffset);
        }
        // If the cursor is at the beginning of the string we can consider all
        // options and should not replace any text.
        // e.g. `{{ product | █image_url: crop: 'center' }}`
        // e.g. `{{ product | █ }}`
        if (node.name === params_1.CURSOR) {
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
exports.FilterCompletionProvider = FilterCompletionProvider;
function deprioritized(entry) {
    return { ...entry, deprioritized: true };
}
function appendRequiredParemeters(entry) {
    var _a;
    let insertText = entry.name;
    let insertStyle = vscode_languageserver_1.InsertTextFormat.PlainText;
    if (!((_a = entry === null || entry === void 0 ? void 0 : entry.parameters) === null || _a === void 0 ? void 0 : _a.length)) {
        return { insertText, insertStyle };
    }
    const requiredPositionalParams = entry.parameters
        .filter((p) => p.required && p.positional)
        .map(formatParameter);
    const requiredNamedParams = entry.parameters
        .filter((p) => p.required && !p.positional)
        .map(formatParameter);
    if (requiredPositionalParams.length) {
        insertText += `: ${requiredPositionalParams.join(', ')}`;
        insertStyle = vscode_languageserver_1.InsertTextFormat.Snippet;
    }
    if (requiredNamedParams.length) {
        insertText += `: ${requiredNamedParams.join(', ')}`;
        insertStyle = vscode_languageserver_1.InsertTextFormat.Snippet;
    }
    return {
        insertText,
        insertStyle,
    };
}
function formatParameter(parameter, index) {
    let cursorLocation = '';
    if (parameter.positional) {
        cursorLocation = `$\{${index + 1}:${parameter.name}\}`;
    }
    else {
        cursorLocation = `$${index + 1}`;
    }
    if (parameter.types[0] === 'string') {
        cursorLocation = `'${cursorLocation}'`;
    }
    return parameter.positional ? cursorLocation : `${parameter.name}: ${cursorLocation}`;
}
//# sourceMappingURL=FilterCompletionProvider.js.map