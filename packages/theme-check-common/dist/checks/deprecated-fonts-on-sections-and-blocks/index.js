"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeprecatedFontsOnSectionsAndBlocks = void 0;
const to_schema_1 = require("../../to-schema");
const types_1 = require("../../types");
const json_1 = require("../../json");
const deprecated_fonts_data_1 = require("./deprecated-fonts-data");
exports.DeprecatedFontsOnSectionsAndBlocks = {
    meta: {
        code: 'DeprecatedFontsOnSectionsAndBlocks',
        name: 'Check for deprecated fonts in section and block schema settings values',
        docs: {
            description: 'Warns on deprecated fonts in section and block schema settings values.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-fonts-on-sections-and-blocks',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidRawTag(node) {
                if (node.name !== 'schema' || node.body.kind !== 'json') {
                    return;
                }
                const schema = await (0, to_schema_1.getSchema)(context);
                const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!validSchema || validSchema instanceof Error)
                    return;
                if (!ast || ast instanceof Error)
                    return;
                const offset = node.blockStartPosition.end;
                // 1st: check schema settings for deprecated fonts
                checkSchemaSettingsForDeprecatedFonts(validSchema, offset, ast, context);
                // 2nd: check local blocks settings for deprecated fonts
                checkLocalBlocksSettingsForDeprecatedFonts(validSchema, offset, ast, context);
                // 3rd: check preset settings for deprecated fonts
                await checkPresetsForDeprecatedFonts(validSchema, offset, ast, context);
                // 4th: check schema default (sections only) for deprecated fonts
                if ('default' in validSchema) {
                    await checkSchemaDefaultForDeprecatedFonts(validSchema, offset, ast, context);
                }
            },
        };
    },
};
function checkSchemaSettingsForDeprecatedFonts(schema, offset, ast, context) {
    const settings = schema.settings;
    if (!settings)
        return;
    checkSettingsForDeprecatedFonts(settings, offset, ast, ['settings'], context);
}
function checkSettingsForDeprecatedFonts(settings, offset, ast, warningAstPath, context) {
    settings.forEach((setting, index) => {
        if (setting.type === 'font_picker' &&
            setting.default &&
            deprecated_fonts_data_1.DEPRECATED_FONT_HANDLES.has(setting.default)) {
            const currentPath = warningAstPath.concat([String(index), 'default']);
            reportWarning(context, offset, ast, currentPath, `setting '${setting.id}' is using deprecated font '${setting.default}'`);
        }
    });
}
function checkLocalBlocksSettingsForDeprecatedFonts(schema, offset, ast, context) {
    const blocks = schema.blocks;
    if (!blocks)
        return;
    blocks.forEach((block, index) => {
        if ('settings' in block && block.settings) {
            checkSettingsForDeprecatedFonts(block.settings, offset, ast, ['blocks', String(index), 'settings'], context);
        }
    });
}
async function checkPresetsForDeprecatedFonts(schema, offset, ast, context) {
    var _a;
    const presets = schema.presets;
    if (!presets)
        return;
    for (const [preset_index, preset] of presets.entries()) {
        const warningAstPath = ['presets', String(preset_index)];
        await checkSettingsAndBlocksForDeprecatedFonts((_a = preset.settings) !== null && _a !== void 0 ? _a : {}, 'blocks' in preset ? preset.blocks : undefined, schema, offset, ast, warningAstPath, context);
    }
}
async function checkSettingsAndBlocksForDeprecatedFonts(settings, blocks, schema, offset, ast, warningAstPath, context) {
    // check settings for deprecated fonts
    if (settings && typeof settings === 'object') {
        Object.entries(settings).forEach(([settingKey, settingValue]) => {
            var _a;
            if (isFontPickerType((_a = schema.settings) !== null && _a !== void 0 ? _a : [], settingKey) &&
                deprecated_fonts_data_1.DEPRECATED_FONT_HANDLES.has(settingValue)) {
                const currentPath = warningAstPath.concat(['settings', settingKey]);
                reportWarning(context, offset, ast, currentPath, `setting '${settingKey}' is using deprecated font '${settingValue}'`);
            }
        });
    }
    // check blocks for deprecated fonts
    if (blocks) {
        await checkBlocksForDeprecatedFonts(blocks, schema, offset, ast, context, warningAstPath);
    }
}
async function checkBlocksForDeprecatedFonts(blocks, schema, offset, ast, context, nodePath) {
    var _a, _b, _c, _d;
    const iterator = Array.isArray(blocks) ? blocks.entries() : Object.entries(blocks);
    for (const [keyOrIndex, block] of iterator) {
        const currentPath = nodePath.concat(['blocks', String(keyOrIndex)]);
        // we'll need the schema to verify that the setting is a font_picker type
        // local blocks don't have a schema coming from the another theme file, we need to get it from the schema of the section
        // look in the schema blocks for the block type, if this block has a name, it's a local block, otherwise, it's a theme block
        let validSchema = null;
        (_a = schema.blocks) === null || _a === void 0 ? void 0 : _a.forEach((schemaBlock) => {
            if (schemaBlock.type === block.type && 'name' in schemaBlock) {
                validSchema = schemaBlock;
            }
        });
        if (!validSchema) {
            const blockSchema = await ((_b = context.getBlockSchema) === null || _b === void 0 ? void 0 : _b.call(context, block.type));
            if (!blockSchema || blockSchema instanceof Error)
                continue;
            validSchema = blockSchema.validSchema;
            if (!validSchema || validSchema instanceof Error)
                continue;
        }
        // block_value is the hash which can have settings, blocks, etc.
        for (const [settingKey, settingValue] of Object.entries((_c = block.settings) !== null && _c !== void 0 ? _c : {})) {
            if (settingValue && deprecated_fonts_data_1.DEPRECATED_FONT_HANDLES.has(settingValue)) {
                // Check if the setting is a font_picker
                const isFontPickerSetting = isFontPickerType((_d = validSchema.settings) !== null && _d !== void 0 ? _d : [], settingKey);
                if (isFontPickerSetting) {
                    reportWarning(context, offset, ast, currentPath.concat(['settings', settingKey]), `setting '${settingKey}' is using deprecated font '${settingValue}'`);
                }
            }
        }
        if ('blocks' in block && block.blocks) {
            await checkBlocksForDeprecatedFonts(block.blocks, schema, offset, ast, context, currentPath);
        }
    }
}
async function checkSchemaDefaultForDeprecatedFonts(schema, offset, ast, context) {
    var _a;
    const defaultValues = schema.default;
    if (!defaultValues || typeof defaultValues !== 'object')
        return;
    const warningAstPath = ['default'];
    await checkSettingsAndBlocksForDeprecatedFonts((_a = defaultValues.settings) !== null && _a !== void 0 ? _a : {}, 'blocks' in defaultValues ? defaultValues.blocks : undefined, schema, offset, ast, warningAstPath, context);
}
function isFontPickerType(settings, settingKey) {
    return settings.some((setting) => setting.id === settingKey && setting.type === 'font_picker');
}
function reportWarning(context, offset, ast, ast_path, message, fullHighlight = true) {
    const node = (0, json_1.nodeAtPath)(ast, ast_path);
    const startIndex = fullHighlight ? offset + (0, json_1.getLocStart)(node) : offset + (0, json_1.getLocEnd)(node) - 1; // start to finish of the node or last char of the node
    const endIndex = offset + (0, json_1.getLocEnd)(node);
    context.report({
        message: message,
        startIndex,
        endIndex,
    });
}
//# sourceMappingURL=index.js.map