"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrphanedSnippet = void 0;
const to_schema_1 = require("../../to-schema");
const types_1 = require("../../types");
exports.OrphanedSnippet = {
    meta: {
        code: 'OrphanedSnippet',
        name: 'Prevent orphaned snippets',
        docs: {
            description: 'This check exists to prevent orphaned snippets in themes.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/orphaned-snippet',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async onCodePathEnd() {
                const { getReferences } = context;
                if (!getReferences) {
                    return;
                }
                const fileUri = context.file.uri;
                if ((0, to_schema_1.isSnippet)(fileUri)) {
                    const references = await getReferences(fileUri);
                    if (references.length === 0) {
                        context.report({
                            message: `This snippet is not referenced by any other files`,
                            startIndex: 0,
                            endIndex: 1,
                        });
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map