"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectAttributeCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const TypeSystem_1 = require("../../TypeSystem");
const params_1 = require("../params");
const common_1 = require("./common");
const ArrayCoreProperties = ['size', 'first', 'last'];
const StringCoreProperties = ['size'];
class ObjectAttributeCompletionProvider {
    constructor(typeSystem, getThemeSettingsSchema) {
        this.typeSystem = typeSystem;
        this.getThemeSettingsSchema = getThemeSettingsSchema;
    }
    async completions(params) {
        var _a;
        if (!params.completionContext)
            return [];
        const { partialAst, node } = params.completionContext;
        if (!node || node.type !== liquid_html_parser_1.NodeTypes.VariableLookup) {
            return [];
        }
        if (node.lookups.length === 0) {
            // We only do lookups in this one
            return [];
        }
        const lastLookup = node.lookups.at(-1);
        if (lastLookup.type !== liquid_html_parser_1.NodeTypes.String) {
            // We don't complete numbers, or variable lookups
            return [];
        }
        const partial = lastLookup.value.replace(params_1.CURSOR, '');
        // Fake a VariableLookup up to the last one.
        const parentLookup = { ...node };
        parentLookup.lookups = [...parentLookup.lookups];
        parentLookup.lookups.pop();
        const parentType = await this.typeSystem.inferType(parentLookup, partialAst, params.textDocument.uri);
        if ((0, TypeSystem_1.isArrayType)(parentType)) {
            return completionItems(ArrayCoreProperties.map((name) => ({ name })), partial);
        }
        else if (parentType === 'string') {
            return completionItems(StringCoreProperties.map((name) => ({ name })), partial);
        }
        const objectMap = await this.typeSystem.objectMap(params.textDocument.uri, partialAst);
        const parentTypeProperties = ((_a = objectMap[parentType]) === null || _a === void 0 ? void 0 : _a.properties) || [];
        return completionItems(parentTypeProperties, partial);
    }
}
exports.ObjectAttributeCompletionProvider = ObjectAttributeCompletionProvider;
function completionItems(options, partial) {
    return options
        .filter(({ name }) => name.startsWith(partial))
        .sort(common_1.sortByName)
        .map(toPropertyCompletionItem);
}
function toPropertyCompletionItem(object) {
    return (0, common_1.createCompletionItem)(object, { kind: vscode_languageserver_1.CompletionItemKind.Variable });
}
//# sourceMappingURL=ObjectAttributeCompletionProvider.js.map