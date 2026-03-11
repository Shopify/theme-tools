import { autocompletion, pickedCompletion, snippet, } from '@codemirror/autocomplete';
import { CompletionItemKind, CompletionRequest, InsertTextFormat, InsertReplaceEdit, TextEdit, CompletionTriggerKind, } from 'vscode-languageserver-protocol';
import { clientFacet, fileUriFacet, serverCapabilitiesFacet } from './client';
import { textDocumentField } from './textDocumentSync';
import { Facet } from '@codemirror/state';
import { translateSnippet } from './snippet';
export const lspComplete = (overrides = {}) => autocompletion({
    activateOnTyping: true,
    override: [complete],
    maxRenderedOptions: 20,
    ...overrides,
});
export const infoRendererFacet = Facet.define({
    static: true,
    combine: (values) => { var _a; return (_a = values[0]) !== null && _a !== void 0 ? _a : undefined; },
});
export async function complete(context) {
    var _a, _b, _c;
    const word = context.matchBefore(/\w+/);
    const serverCapabilities = context.state.facet(serverCapabilitiesFacet.reader);
    const triggerCharacters = (_b = (_a = serverCapabilities.completionProvider) === null || _a === void 0 ? void 0 : _a.triggerCharacters) !== null && _b !== void 0 ? _b : [];
    const previousChar = context.state.doc.sliceString(context.pos - 1, context.pos);
    const isTriggerCharacter = triggerCharacters.includes(previousChar);
    const canComplete = isTriggerCharacter || word || context.pos === 0;
    if (!canComplete)
        return null;
    const client = context.state.facet(clientFacet.reader);
    const fileUri = context.state.facet(fileUriFacet.reader);
    const infoRenderer = context.state.facet(infoRendererFacet.reader);
    const textDocument = context.state.field(textDocumentField);
    const lspContext = isTriggerCharacter
        ? { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: previousChar }
        : { triggerKind: CompletionTriggerKind.Invoked };
    const results = await client.sendRequest(CompletionRequest.type, {
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
        case InsertTextFormat.Snippet:
            return {
                label: (_a = completionItem.insertText) !== null && _a !== void 0 ? _a : completionItem.label,
                displayLabel: completionItem.label,
                apply: applySnippet(completionItem, textDocument),
                type: convertLSPKindToCodeMirrorKind(completionItem.kind),
                info: infoRenderer ? (_) => infoRenderer(completionItem) : undefined,
            };
        case InsertTextFormat.PlainText:
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
        (TextEdit.is(completionItem.textEdit) || InsertReplaceEdit.is(completionItem.textEdit)));
}
const applySnippet = (item, textDocument) => {
    const { textEdit } = item;
    let from = null;
    let to = null;
    let newText = '';
    if (TextEdit.is(textEdit)) {
        from = textDocument.offsetAt(textEdit.range.start);
        to = textDocument.offsetAt(textEdit.range.end);
        newText = textEdit.newText;
    }
    else if (textEdit && InsertReplaceEdit.is(textEdit)) {
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
    const template = translateSnippet(newText);
    // Because we might replace text with textEdit, we can't use snippet as is.
    // we'll need to infer the from/to from the textEdit.
    const apply = snippet(template);
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
        case CompletionItemKind.Constructor:
        case CompletionItemKind.Class:
            return CMCompletionType.Class;
        case CompletionItemKind.Constant:
            return CMCompletionType.Constant;
        case CompletionItemKind.Enum:
        case CompletionItemKind.EnumMember:
            return CMCompletionType.Enum;
        case CompletionItemKind.Snippet:
        case CompletionItemKind.Function:
            return CMCompletionType.Function;
        case CompletionItemKind.Interface:
            return CMCompletionType.Interface;
        case CompletionItemKind.Operator:
        case CompletionItemKind.Keyword:
            return CMCompletionType.Keyword;
        case CompletionItemKind.Method:
            return CMCompletionType.Method;
        case CompletionItemKind.File:
        case CompletionItemKind.Folder:
        case CompletionItemKind.Module:
            return CMCompletionType.Namespace;
        case CompletionItemKind.Property:
        case CompletionItemKind.Reference:
        case CompletionItemKind.Field:
            return CMCompletionType.Property;
        case CompletionItemKind.Struct:
        case CompletionItemKind.TypeParameter:
            return CMCompletionType.Type;
        case CompletionItemKind.Event:
        case CompletionItemKind.Value:
        case CompletionItemKind.Variable:
            return CMCompletionType.Variable;
        case CompletionItemKind.Color:
        case CompletionItemKind.Unit:
        case CompletionItemKind.Text:
        default:
            return CMCompletionType.Text;
    }
}
function applyEdit(view, completion, item, textDocument) {
    const { textEdit } = item;
    let start = 0;
    let end = 0;
    let newText = '';
    if (TextEdit.is(textEdit)) {
        start = textDocument.offsetAt(textEdit.range.start);
        end = textDocument.offsetAt(textEdit.range.end);
        newText = textEdit.newText;
    }
    else if (InsertReplaceEdit.is(textEdit)) {
        start = textDocument.offsetAt(textEdit.replace.start);
        end = textDocument.offsetAt(textEdit.replace.end);
        newText = textEdit.newText;
    }
    view.dispatch({
        // Tell the completion engine which item we chose
        annotations: [pickedCompletion.of(completion)],
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
//# sourceMappingURL=complete.js.map