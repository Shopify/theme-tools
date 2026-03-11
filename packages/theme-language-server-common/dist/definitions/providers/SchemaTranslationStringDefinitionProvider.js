"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaTranslationStringDefinitionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
class SchemaTranslationStringDefinitionProvider {
    constructor(documentManager, getDefaultSchemaLocaleSourceCode) {
        this.documentManager = documentManager;
        this.getDefaultSchemaLocaleSourceCode = getDefaultSchemaLocaleSourceCode;
    }
    async definitions(params, node, ancestors) {
        const sourceCode = this.documentManager.get(params.textDocument.uri);
        if (!sourceCode || sourceCode.type !== theme_check_common_1.SourceCodeType.LiquidHtml)
            return [];
        // We want text inside {% schema %}
        if (node.type !== liquid_html_parser_1.NodeTypes.TextNode)
            return [];
        const schemaTag = ancestors.find(isSchemaTag);
        if (!schemaTag) {
            return [];
        }
        const schema = await sourceCode.getSchema();
        if (!schema || schema.ast instanceof Error)
            return [];
        // Now we need to find the location of the translation in the translation file
        const defaultLocaleFile = await this.getDefaultSchemaLocaleSourceCode(params.textDocument.uri);
        if (!defaultLocaleFile ||
            defaultLocaleFile.type !== theme_check_common_1.SourceCodeType.JSON ||
            defaultLocaleFile.ast instanceof Error) {
            return [];
        }
        const documentOffset = sourceCode.textDocument.offsetAt(params.position);
        const offset = documentOffset - schema.offset;
        const [jNode, _jAncestors] = (0, theme_check_common_1.findJSONNode)(schema.ast, offset);
        if (jNode.type !== 'Literal')
            return [];
        if (typeof jNode.value !== 'string' || !jNode.value.startsWith('t:'))
            return [];
        const translationKey = jNode.value.slice(2).trim();
        const translationNode = (0, theme_check_common_1.nodeAtPath)(defaultLocaleFile.ast, translationKey.split('.'));
        if (!translationNode)
            return [];
        const targetRange = vscode_languageserver_protocol_1.Range.create(defaultLocaleFile.textDocument.positionAt(translationNode.loc.start.offset), defaultLocaleFile.textDocument.positionAt(translationNode.loc.end.offset));
        const originRange = vscode_languageserver_protocol_1.Range.create(sourceCode.textDocument.positionAt(schema.offset + jNode.loc.start.offset), sourceCode.textDocument.positionAt(schema.offset + jNode.loc.end.offset));
        return [
            vscode_languageserver_protocol_1.LocationLink.create(defaultLocaleFile.textDocument.uri, targetRange, targetRange, originRange),
        ];
    }
}
exports.SchemaTranslationStringDefinitionProvider = SchemaTranslationStringDefinitionProvider;
function isSchemaTag(node) {
    return node.type === liquid_html_parser_1.NodeTypes.LiquidRawTag && node.name === 'schema';
}
//# sourceMappingURL=SchemaTranslationStringDefinitionProvider.js.map