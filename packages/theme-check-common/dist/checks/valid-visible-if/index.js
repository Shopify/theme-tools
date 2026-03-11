"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidVisibleIfSettingsSchema = exports.ValidVisibleIf = void 0;
const types_1 = require("../../types");
const json_1 = require("../../json");
const to_schema_1 = require("../../to-schema");
const utils_1 = require("../../utils");
const visible_if_utils_1 = require("./visible-if-utils");
// Note that unlike most other files in the `checks` directory, this exports two
// checks: one for Liquid files and one for 'config/settings_schema.json'. They
// perform the same check using the same logic (modulo differences extracting
// the schema and determining warning start and end indices).
const meta = {
    code: 'ValidVisibleIf',
    name: 'Validate visible_if expressions',
    docs: {
        description: 'Ensures visible_if expressions are well-formed and only reference settings keys that are defined',
        recommended: true,
        url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-visible-if',
    },
    severity: types_1.Severity.ERROR,
    schema: {},
    targets: [],
};
exports.ValidVisibleIf = {
    meta: { ...meta, type: types_1.SourceCodeType.LiquidHtml },
    create(context) {
        return {
            async LiquidRawTag(node) {
                var _a;
                if (node.name !== 'schema' || node.body.kind !== 'json')
                    return;
                const schema = await (0, to_schema_1.getSchema)(context);
                const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!validSchema ||
                    validSchema instanceof Error ||
                    !((_a = validSchema.settings) === null || _a === void 0 ? void 0 : _a.some((setting) => 'visible_if' in setting)) ||
                    !ast ||
                    ast instanceof Error) {
                    return;
                }
                const offset = node.blockStartPosition.end;
                const settings = Object.fromEntries((await (0, visible_if_utils_1.getGlobalSettings)(context)).map((s) => [s, true]));
                const currentFileSettings = Object.fromEntries(validSchema.settings.map((setting) => [setting.id, true]));
                const vars = { settings };
                if ((0, to_schema_1.isSectionSchema)(schema)) {
                    vars.section = { settings: currentFileSettings };
                }
                else if ((0, to_schema_1.isBlockSchema)(schema)) {
                    vars.block = { settings: currentFileSettings };
                }
                for (const [i, setting] of validSchema.settings.entries()) {
                    if (!('visible_if' in setting) || typeof setting.visible_if !== 'string')
                        continue;
                    const visibleIfNode = (0, json_1.nodeAtPath)(ast, ['settings', i, 'visible_if']);
                    const varLookupsOrWarning = (0, visible_if_utils_1.getVariableLookupsInExpression)(setting.visible_if);
                    if (varLookupsOrWarning === null)
                        continue;
                    if ('warning' in varLookupsOrWarning) {
                        (0, utils_1.reportWarning)(varLookupsOrWarning.warning, offset, visibleIfNode, context);
                        continue;
                    }
                    const report = (message, lookup) => {
                        if (typeof message === 'string') {
                            context.report({
                                message,
                                // the JSONNode start location returned by `getLocStart`
                                // includes the opening quotation mark — whereas when we parse
                                // the inner expression, 0 is the location _inside_ the quotes.
                                // we add 1 to the offsets to compensate.
                                startIndex: offset + (0, json_1.getLocStart)(visibleIfNode) + lookup.position.start + visible_if_utils_1.offsetAdjust + 1,
                                endIndex: offset + (0, json_1.getLocStart)(visibleIfNode) + lookup.position.end + visible_if_utils_1.offsetAdjust + 1,
                            });
                        }
                    };
                    for (const lookup of varLookupsOrWarning) {
                        if (lookup.name === 'section' && (0, to_schema_1.isBlockSchema)(schema)) {
                            //no-op, we don't know what section this block will be used in, so we can't validate that the setting exists
                        }
                        else if (lookup.name === 'section' && !(0, to_schema_1.isSectionSchema)(schema)) {
                            report(`Invalid visible_if: can't refer to "section" when not in a section or block file.`, lookup);
                        }
                        else if (lookup.name === 'block' && !(0, to_schema_1.isBlockSchema)(schema)) {
                            report(`Invalid visible_if: can't refer to "block" when not in a block file.`, lookup);
                        }
                        else {
                            report((0, visible_if_utils_1.validateLookup)(lookup, vars), lookup);
                        }
                    }
                }
            },
        };
    },
};
exports.ValidVisibleIfSettingsSchema = {
    meta: { ...meta, type: types_1.SourceCodeType.JSON },
    create(context) {
        const relativePath = context.toRelativePath(context.file.uri);
        if (relativePath !== 'config/settings_schema.json')
            return {};
        return {
            async Property(node) {
                if (node.key.value !== 'visible_if' || node.value.type !== 'Literal')
                    return;
                const visibleIfExpression = node.value.value;
                if (typeof visibleIfExpression !== 'string')
                    return;
                const offset = node.value.loc.start.offset;
                const varLookupsOrWarning = (0, visible_if_utils_1.getVariableLookupsInExpression)(visibleIfExpression);
                if (varLookupsOrWarning === null)
                    return;
                if ('warning' in varLookupsOrWarning) {
                    context.report({
                        message: varLookupsOrWarning.warning,
                        startIndex: node.value.loc.start.offset,
                        endIndex: node.value.loc.end.offset,
                    });
                    return;
                }
                const settings = Object.fromEntries((await (0, visible_if_utils_1.getGlobalSettings)(context)).map((s) => [s, true]));
                const vars = { settings };
                const report = (message, lookup) => {
                    if (typeof message === 'string') {
                        context.report({
                            message,
                            startIndex: offset + lookup.position.start + visible_if_utils_1.offsetAdjust + 1,
                            endIndex: offset + lookup.position.end + visible_if_utils_1.offsetAdjust + 1,
                        });
                    }
                };
                for (const lookup of varLookupsOrWarning) {
                    // settings_schema.json can't reference `section` or `block`.
                    if (lookup.name === 'section') {
                        report(`Invalid visible_if: can't refer to "section" when not in a section file.`, lookup);
                    }
                    else if (lookup.name === 'block') {
                        report(`Invalid visible_if: can't refer to "block" when not in a block file.`, lookup);
                    }
                    else {
                        report((0, visible_if_utils_1.validateLookup)(lookup, vars), lookup);
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map