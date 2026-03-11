"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppBlockMissingSchema = void 0;
const types_1 = require("../../types");
exports.AppBlockMissingSchema = {
    meta: {
        code: 'AppBlockMissingSchema',
        name: 'Missing schema definitions in theme app extensions app blocks should be avoided',
        docs: {
            description: 'Report missing schema definitions in theme app extensions app blocks',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/app-block-missing-schema',
        },
        severity: types_1.Severity.ERROR,
        type: types_1.SourceCodeType.LiquidHtml,
        schema: {},
        targets: [types_1.ConfigTarget.ThemeAppExtension],
    },
    create(context) {
        let foundSchema = false;
        const relativePath = context.toRelativePath(context.file.uri);
        /**
         * Theme app extension blocks are the only types of files that can have a
         * schema defined in them.
         */
        if (!relativePath.startsWith('blocks/')) {
            return {};
        }
        return {
            async LiquidRawTag(node) {
                if (node.name == 'schema')
                    foundSchema = true;
            },
            async onCodePathEnd() {
                if (!foundSchema) {
                    context.report({
                        message: `The schema does not exist`,
                        startIndex: 0,
                        endIndex: 0,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map