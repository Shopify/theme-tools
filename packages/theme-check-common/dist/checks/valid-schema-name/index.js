"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidSchemaName = void 0;
const json_1 = require("../../json");
const to_schema_1 = require("../../to-schema");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const MAX_SCHEMA_NAME_LENGTH = 25;
exports.ValidSchemaName = {
    meta: {
        code: 'ValidSchemaName',
        name: 'Enforce valid schema name',
        docs: {
            description: 'This check is aimed at ensuring a valid schema name.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema-name',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidRawTag(node) {
                if (node.name !== 'schema' || node.body.kind !== 'json') {
                    return;
                }
                const offset = node.blockStartPosition.end;
                const schema = await (0, to_schema_1.getSchema)(context);
                const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!validSchema || validSchema instanceof Error)
                    return;
                if (!ast || ast instanceof Error)
                    return;
                const name = validSchema.name;
                if (!name)
                    return;
                // We can make this type assertion because we know the schema is valid
                const nameNode = (0, json_1.nodeAtPath)(ast, ['name']);
                const startIndex = offset + (0, json_1.getLocStart)(nameNode);
                const endIndex = offset + (0, json_1.getLocEnd)(nameNode);
                if (name.startsWith('t:')) {
                    const defaultLocale = await context.getDefaultLocale();
                    const key = name.replace('t:', '');
                    const defaultTranslations = await context.getDefaultSchemaTranslations();
                    const translation = (0, utils_1.deepGet)(defaultTranslations, key.split('.'));
                    if (translation !== undefined && translation.length > MAX_SCHEMA_NAME_LENGTH) {
                        context.report({
                            message: `Schema name '${translation}' from 'locales/${defaultLocale}.default.schema.json' is too long (max 25 characters)`,
                            startIndex,
                            endIndex,
                        });
                    }
                }
                else if (name.length > MAX_SCHEMA_NAME_LENGTH) {
                    context.report({
                        message: `Schema name '${name}' is too long (max 25 characters)`,
                        startIndex,
                        endIndex,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map