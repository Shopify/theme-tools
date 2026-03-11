"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestParams = getRequestParams;
exports.isCompletionList = isCompletionList;
exports.mockJSONLanguageService = mockJSONLanguageService;
const JSONLanguageService_1 = require("../JSONLanguageService");
const theme_check_common_1 = require("@shopify/theme-check-common");
function getRequestParams(documentManager, relativePath, source) {
    const uri = `file:///root/${relativePath}`;
    const sourceWithoutCursor = source.replace('█', '');
    documentManager.open(uri, sourceWithoutCursor, 1);
    const doc = documentManager.get(uri).textDocument;
    const position = doc.positionAt(source.indexOf('█'));
    return {
        textDocument: { uri: uri },
        position: position,
    };
}
function isCompletionList(completions) {
    return completions !== null && !Array.isArray(completions);
}
function mockJSONLanguageService(rootUri, documentManager, getDefaultSchemaTranslations = async () => ({}), getThemeBlockNames = async () => []) {
    return new JSONLanguageService_1.JSONLanguageService(documentManager, {
        schemas: async () => [
            {
                uri: 'https://shopify.dev/block-schema.json',
                schema: JSON.stringify({
                    $schema: 'http://json-schema.org/draft-07/schema#',
                }),
                fileMatch: ['**/{blocks,sections}/*.liquid'],
            },
        ],
    }, getDefaultSchemaTranslations, async () => 'theme', getThemeBlockNames, async (_uri, name) => {
        const blockUri = `${rootUri}/blocks/${name}.liquid`;
        const doc = documentManager.get(blockUri);
        if (!doc || doc.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
            return;
        }
        return doc.getSchema();
    }, async () => rootUri);
}
//# sourceMappingURL=test-helpers.js.map