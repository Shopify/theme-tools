"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationStringDefinitionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
class TranslationStringDefinitionProvider {
    constructor(documentManager, getDefaultLocaleSourceCode) {
        this.documentManager = documentManager;
        this.getDefaultLocaleSourceCode = getDefaultLocaleSourceCode;
    }
    async definitions(params, node, ancestors) {
        var _a;
        const doc = (_a = this.documentManager.get(params.textDocument.uri)) === null || _a === void 0 ? void 0 : _a.textDocument;
        if (!doc)
            return [];
        // We want {{ node | t }}
        if (node.type !== liquid_html_parser_1.NodeTypes.String)
            return [];
        const parent = ancestors.at(-1);
        if (!parent || parent.type !== liquid_html_parser_1.NodeTypes.LiquidVariable)
            return [];
        // Making sure node is the expression
        if (parent.expression !== node)
            return [];
        // We're looking for {{ '...' | t }} or {{ '...' | translate }}
        if (parent.filters.length === 0 || !['t', 'translate'].includes(parent.filters[0].name)) {
            return [];
        }
        // Now we need to find the location of the translation in the translation file
        const defaultLocaleFile = await this.getDefaultLocaleSourceCode(params.textDocument.uri);
        if (!defaultLocaleFile ||
            defaultLocaleFile.type !== theme_check_common_1.SourceCodeType.JSON ||
            defaultLocaleFile.ast instanceof Error) {
            return [];
        }
        const translationKey = node.value;
        const translationNode = (0, theme_check_common_1.nodeAtPath)(defaultLocaleFile.ast, translationKey.split('.'));
        if (!translationNode)
            return [];
        const targetRange = vscode_languageserver_protocol_1.Range.create(defaultLocaleFile.textDocument.positionAt(translationNode.loc.start.offset), defaultLocaleFile.textDocument.positionAt(translationNode.loc.end.offset));
        const originRange = vscode_languageserver_protocol_1.Range.create(doc.positionAt(node.position.start), doc.positionAt(node.position.end));
        return [
            vscode_languageserver_protocol_1.LocationLink.create(defaultLocaleFile.textDocument.uri, targetRange, targetRange, originRange),
        ];
    }
}
exports.TranslationStringDefinitionProvider = TranslationStringDefinitionProvider;
//# sourceMappingURL=TranslationStringDefinitionProvider.js.map