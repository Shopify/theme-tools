"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyBlockContent = void 0;
const types_1 = require("../../types");
const to_schema_1 = require("../../to-schema");
exports.EmptyBlockContent = {
    meta: {
        code: 'EmptyBlockContent',
        name: 'Prevent empty block content',
        docs: {
            description: 'This check exists to warn you when the blocks array at the root level of the schema is empty.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/empty-block-content',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        let isContentForBlocksLocationSet = false;
        let contentForBlocksLocation = { start: 0, end: 0 };
        return {
            async LiquidTag(node) {
                if (node.name !== 'content_for')
                    return;
                const nodeMarkup = node.markup;
                if (typeof nodeMarkup === 'object' && nodeMarkup.contentForType.value === 'blocks') {
                    contentForBlocksLocation.start = node.blockStartPosition.start;
                    contentForBlocksLocation.end = node.blockStartPosition.end;
                    isContentForBlocksLocationSet = true;
                }
            },
            async onCodePathEnd() {
                const schema = await (0, to_schema_1.getSchema)(context);
                const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!validSchema || validSchema instanceof Error)
                    return;
                if (!ast || ast instanceof Error)
                    return;
                const blocks = validSchema.blocks;
                if (isContentForBlocksLocationSet && !blocks) {
                    context.report({
                        message: `The 'content_for "blocks"' tag is present, but the blocks array is not defined.`,
                        startIndex: contentForBlocksLocation.start,
                        endIndex: contentForBlocksLocation.end,
                    });
                }
                else if (isContentForBlocksLocationSet && blocks && blocks.length === 0) {
                    context.report({
                        message: `The 'content_for "blocks"' tag is present, but the blocks array is empty.`,
                        startIndex: contentForBlocksLocation.start,
                        endIndex: contentForBlocksLocation.end,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map