"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidSettingsKey = void 0;
const types_1 = require("../../types");
const json_1 = require("../../json");
const to_schema_1 = require("../../to-schema");
const utils_1 = require("../../utils");
exports.ValidSettingsKey = {
    meta: {
        code: 'ValidSettingsKey',
        name: 'Validate settings key in presets',
        docs: {
            description: 'Ensures settings key only references valid settings defined in its respective schema',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-settings-key',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidRawTag(node) {
                var _a;
                if (node.name !== 'schema' || node.body.kind !== 'json')
                    return;
                const offset = node.blockStartPosition.end;
                const schema = await (0, to_schema_1.getSchema)(context);
                const { validSchema, ast } = schema !== null && schema !== void 0 ? schema : {};
                if (!validSchema || validSchema instanceof Error)
                    return;
                if (!ast || ast instanceof Error)
                    return;
                const { rootLevelLocalBlocks, presetLevelBlocks } = (0, utils_1.getBlocks)(validSchema);
                // Check if presets settings match schema-level settings
                if (validSchema.presets) {
                    for (let i = 0; i < validSchema.presets.length; i++) {
                        const settingsNode = (0, json_1.nodeAtPath)(ast, ['presets', i, 'settings']);
                        validateSettingsKey(context, offset, settingsNode, validSchema.settings);
                    }
                }
                if ((0, to_schema_1.isSectionSchema)(schema) && 'default' in validSchema && validSchema.default) {
                    // Check if default settings match schema-level settings
                    const settingsNode = (0, json_1.nodeAtPath)(ast, ['default', 'settings']);
                    validateSettingsKey(context, offset, settingsNode, validSchema.settings);
                    // Check if default block settings match the settings defined in the block file's schema
                    (_a = validSchema.default.blocks) === null || _a === void 0 ? void 0 : _a.forEach((block, i) => {
                        const settingsNode = (0, json_1.nodeAtPath)(ast, ['default', 'blocks', i, 'settings']);
                        validateReferencedBlock(context, offset, settingsNode, rootLevelLocalBlocks, block);
                    });
                }
                // Check if preset block settings match the settings defined in the block file's schema
                for (const [_depthStr, blocks] of Object.entries(presetLevelBlocks)) {
                    blocks.forEach(({ node: blockNode, path }) => {
                        const settingsNode = (0, json_1.nodeAtPath)(ast, path.slice(0, -1).concat('settings'));
                        validateReferencedBlock(context, offset, settingsNode, rootLevelLocalBlocks, blockNode);
                    });
                }
            },
        };
    },
};
async function validateReferencedBlock(context, offset, settingsNode, localBlocks, referencedBlock) {
    var _a;
    if (localBlocks.length > 0) {
        const localBlock = localBlocks.find((localBlock) => localBlock.node.type === referencedBlock.type);
        if (!localBlock)
            return;
        const localBlockNode = localBlock.node;
        validateSettingsKey(context, offset, settingsNode, localBlockNode.settings);
    }
    else {
        const blockSchema = await ((_a = context.getBlockSchema) === null || _a === void 0 ? void 0 : _a.call(context, referencedBlock.type));
        const { validSchema: validBlockSchema } = blockSchema !== null && blockSchema !== void 0 ? blockSchema : {};
        if (!validBlockSchema || validBlockSchema instanceof Error)
            return;
        validateSettingsKey(context, offset, settingsNode, validBlockSchema.settings, referencedBlock);
    }
}
function validateSettingsKey(context, offset, settingsNode, validSettings, blockNode) {
    if (!settingsNode || settingsNode.type !== 'Object')
        return;
    for (const setting of settingsNode.children) {
        const settingExists = validSettings === null || validSettings === void 0 ? void 0 : validSettings.find((validSetting) => (validSetting === null || validSetting === void 0 ? void 0 : validSetting.id) === setting.key.value);
        if (!settingExists) {
            const errorMessage = blockNode
                ? `Setting '${setting.key.value}' does not exist in 'blocks/${blockNode.type}.liquid'.`
                : `Setting '${setting.key.value}' does not exist in schema.`;
            (0, utils_1.reportWarning)(errorMessage, offset, setting.key, context);
        }
    }
}
//# sourceMappingURL=index.js.map