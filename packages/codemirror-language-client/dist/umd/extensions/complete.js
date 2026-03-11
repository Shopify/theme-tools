(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "@codemirror/autocomplete", "vscode-languageserver-protocol", "./client", "./textDocumentSync", "@codemirror/state", "./snippet"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.infoRendererFacet = exports.lspComplete = void 0;
    exports.complete = complete;
    const autocomplete_1 = require("@codemirror/autocomplete");
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const client_1 = require("./client");
    const textDocumentSync_1 = require("./textDocumentSync");
    const state_1 = require("@codemirror/state");
    const snippet_1 = require("./snippet");
    const lspComplete = (overrides = {}) => (0, autocomplete_1.autocompletion)({
        activateOnTyping: true,
        override: [complete],
        maxRenderedOptions: 20,
        ...overrides,
    });
    exports.lspComplete = lspComplete;
    exports.infoRendererFacet = state_1.Facet.define({
        static: true,
        combine: (values) => { var _a; return (_a = values[0]) !== null && _a !== void 0 ? _a : undefined; },
    });
    async function complete(context) {
        var _a, _b, _c;
        const word = context.matchBefore(/\w+/);
        const serverCapabilities = context.state.facet(client_1.serverCapabilitiesFacet.reader);
        const triggerCharacters = (_b = (_a = serverCapabilities.completionProvider) === null || _a === void 0 ? void 0 : _a.triggerCharacters) !== null && _b !== void 0 ? _b : [];
        const previousChar = context.state.doc.sliceString(context.pos - 1, context.pos);
        const isTriggerCharacter = triggerCharacters.includes(previousChar);
        const canComplete = isTriggerCharacter || word || context.pos === 0;
        if (!canComplete)
            return null;
        const client = context.state.facet(client_1.clientFacet.reader);
        const fileUri = context.state.facet(client_1.fileUriFacet.reader);
        const infoRenderer = context.state.facet(exports.infoRendererFacet.reader);
        const textDocument = context.state.field(textDocumentSync_1.textDocumentField);
        const lspContext = isTriggerCharacter
            ? { triggerKind: vscode_languageserver_protocol_1.CompletionTriggerKind.TriggerCharacter, triggerCharacter: previousChar }
            : { triggerKind: vscode_languageserver_protocol_1.CompletionTriggerKind.Invoked };
        const results = await client.sendRequest(vscode_languageserver_protocol_1.CompletionRequest.type, {
            textDocument: { uri: fileUri },
            position: textDocument.positionAt(context.pos),
            context: lspContext,
        });
        // No results
        if (results === null || (Array.isArray(results) && results.length === 0))
            return null;
        return {
            from: (_c = word === null || word === void 0 ? void 0 : word.from) !== null && _c !== void 0 ? _c : context.pos,
            options: items(results).map(toCodeMirrorCompletion(infoRenderer, textDocument)),
        };
    }
    const toCodeMirrorCompletion = (infoRenderer, textDocument) => (completionItem) => {
        var _a, _b;
        switch (completionItem.insertTextFormat) {
            case vscode_languageserver_protocol_1.InsertTextFormat.Snippet:
                return {
                    label: (_a = completionItem.insertText) !== null && _a !== void 0 ? _a : completionItem.label,
                    displayLabel: completionItem.label,
                    apply: applySnippet(completionItem, textDocument),
                    type: convertLSPKindToCodeMirrorKind(completionItem.kind),
                    info: infoRenderer ? (_) => infoRenderer(completionItem) : undefined,
                };
            case vscode_languageserver_protocol_1.InsertTextFormat.PlainText:
            default: {
                return {
                    label: (_b = completionItem.insertText) !== null && _b !== void 0 ? _b : completionItem.label,
                    displayLabel: completionItem.label,
                    apply: hasApplicableTextEdit(completionItem)
                        ? (view, completion) => applyEdit(view, completion, completionItem, textDocument)
                        : undefined,
                    type: convertLSPKindToCodeMirrorKind(completionItem.kind),
                    info: infoRenderer ? (_) => infoRenderer(completionItem) : undefined,
                };
            }
        }
    };
    function hasApplicableTextEdit(completionItem) {
        return (!!completionItem.textEdit &&
            (vscode_languageserver_protocol_1.TextEdit.is(completionItem.textEdit) || vscode_languageserver_protocol_1.InsertReplaceEdit.is(completionItem.textEdit)));
    }
    const applySnippet = (item, textDocument) => {
        const { textEdit } = item;
        let from = null;
        let to = null;
        let newText = '';
        if (vscode_languageserver_protocol_1.TextEdit.is(textEdit)) {
            from = textDocument.offsetAt(textEdit.range.start);
            to = textDocument.offsetAt(textEdit.range.end);
            newText = textEdit.newText;
        }
        else if (textEdit && vscode_languageserver_protocol_1.InsertReplaceEdit.is(textEdit)) {
            from = textDocument.offsetAt(textEdit.replace.start);
            to = textDocument.offsetAt(textEdit.replace.end);
            newText = textEdit.newText;
        }
        else if (item.insertText) {
            newText = item.insertText;
        }
        else {
            newText = item.label;
        }
        const template = (0, snippet_1.translateSnippet)(newText);
        // Because we might replace text with textEdit, we can't use snippet as is.
        // we'll need to infer the from/to from the textEdit.
        const apply = (0, autocomplete_1.snippet)(template);
        return (view, completion, defaultFrom, defaultTo) => {
            apply(view, completion, from !== null && from !== void 0 ? from : defaultFrom, to !== null && to !== void 0 ? to : defaultTo);
        };
    };
    var CMCompletionType;
    (function (CMCompletionType) {
        CMCompletionType["Class"] = "class";
        CMCompletionType["Constant"] = "constant";
        CMCompletionType["Enum"] = "enum";
        CMCompletionType["Function"] = "function";
        CMCompletionType["Interface"] = "interface";
        CMCompletionType["Keyword"] = "keyword";
        CMCompletionType["Method"] = "method";
        CMCompletionType["Namespace"] = "namespace";
        CMCompletionType["Property"] = "property";
        CMCompletionType["Text"] = "text";
        CMCompletionType["Type"] = "type";
        CMCompletionType["Variable"] = "variable";
    })(CMCompletionType || (CMCompletionType = {}));
    function convertLSPKindToCodeMirrorKind(kind) {
        if (!kind)
            return CMCompletionType.Text;
        switch (kind) {
            case vscode_languageserver_protocol_1.CompletionItemKind.Constructor:
            case vscode_languageserver_protocol_1.CompletionItemKind.Class:
                return CMCompletionType.Class;
            case vscode_languageserver_protocol_1.CompletionItemKind.Constant:
                return CMCompletionType.Constant;
            case vscode_languageserver_protocol_1.CompletionItemKind.Enum:
            case vscode_languageserver_protocol_1.CompletionItemKind.EnumMember:
                return CMCompletionType.Enum;
            case vscode_languageserver_protocol_1.CompletionItemKind.Snippet:
            case vscode_languageserver_protocol_1.CompletionItemKind.Function:
                return CMCompletionType.Function;
            case vscode_languageserver_protocol_1.CompletionItemKind.Interface:
                return CMCompletionType.Interface;
            case vscode_languageserver_protocol_1.CompletionItemKind.Operator:
            case vscode_languageserver_protocol_1.CompletionItemKind.Keyword:
                return CMCompletionType.Keyword;
            case vscode_languageserver_protocol_1.CompletionItemKind.Method:
                return CMCompletionType.Method;
            case vscode_languageserver_protocol_1.CompletionItemKind.File:
            case vscode_languageserver_protocol_1.CompletionItemKind.Folder:
            case vscode_languageserver_protocol_1.CompletionItemKind.Module:
                return CMCompletionType.Namespace;
            case vscode_languageserver_protocol_1.CompletionItemKind.Property:
            case vscode_languageserver_protocol_1.CompletionItemKind.Reference:
            case vscode_languageserver_protocol_1.CompletionItemKind.Field:
                return CMCompletionType.Property;
            case vscode_languageserver_protocol_1.CompletionItemKind.Struct:
            case vscode_languageserver_protocol_1.CompletionItemKind.TypeParameter:
                return CMCompletionType.Type;
            case vscode_languageserver_protocol_1.CompletionItemKind.Event:
            case vscode_languageserver_protocol_1.CompletionItemKind.Value:
            case vscode_languageserver_protocol_1.CompletionItemKind.Variable:
                return CMCompletionType.Variable;
            case vscode_languageserver_protocol_1.CompletionItemKind.Color:
            case vscode_languageserver_protocol_1.CompletionItemKind.Unit:
            case vscode_languageserver_protocol_1.CompletionItemKind.Text:
            default:
                return CMCompletionType.Text;
        }
    }
    function applyEdit(view, completion, item, textDocument) {
        const { textEdit } = item;
        let start = 0;
        let end = 0;
        let newText = '';
        if (vscode_languageserver_protocol_1.TextEdit.is(textEdit)) {
            start = textDocument.offsetAt(textEdit.range.start);
            end = textDocument.offsetAt(textEdit.range.end);
            newText = textEdit.newText;
        }
        else if (vscode_languageserver_protocol_1.InsertReplaceEdit.is(textEdit)) {
            start = textDocument.offsetAt(textEdit.replace.start);
            end = textDocument.offsetAt(textEdit.replace.end);
            newText = textEdit.newText;
        }
        view.dispatch({
            // Tell the completion engine which item we chose
            annotations: [autocomplete_1.pickedCompletion.of(completion)],
            // Move cursor to after the text
            selection: { anchor: start + newText.length, head: start + newText.length },
            // Apply the text edit
            changes: view.state.changes({
                from: start,
                to: end,
                insert: newText,
            }),
        });
    }
    function isCompletionList(results) {
        return results.isIncomplete !== undefined;
    }
    function items(results) {
        if (isCompletionList(results)) {
            return results.items.map((item) => ({
                ...results.itemDefaults,
                ...item,
            }));
        }
        return results;
    }
});
//# sourceMappingURL=complete.js.map