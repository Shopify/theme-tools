"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONMissingBlock = void 0;
const to_schema_1 = require("../../to-schema");
const types_1 = require("../../types");
const missing_block_utils_1 = require("./missing-block-utils");
exports.JSONMissingBlock = {
    meta: {
        code: 'JSONMissingBlock',
        name: 'Check for missing blocks types in JSON templates',
        docs: {
            description: 'This check ensures that JSON templates contain valid block types.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/json-missing-block',
        },
        type: types_1.SourceCodeType.JSON,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        const relativePath = context.toRelativePath(context.file.uri);
        if (!relativePath.startsWith('templates/'))
            return {};
        return {
            async onCodePathEnd() {
                const schema = await (0, to_schema_1.getSchemaFromJSON)(context);
                const { ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!ast || ast instanceof Error)
                    return;
                if (!schema)
                    return;
                const sections = schema.parsed.sections;
                if (!sections)
                    return;
                await Promise.all(Object.entries(sections).map(async ([sectionKey, section]) => {
                    if ((0, missing_block_utils_1.isPropertyNode)(section) &&
                        'blocks' in section &&
                        (0, missing_block_utils_1.isPropertyNode)(section.blocks) &&
                        'type' in section) {
                        await (0, missing_block_utils_1.getAllBlocks)(ast, 0, section.type, section.blocks, ['sections', sectionKey, 'blocks'], context);
                    }
                }));
            },
        };
    },
};
//# sourceMappingURL=index.js.map