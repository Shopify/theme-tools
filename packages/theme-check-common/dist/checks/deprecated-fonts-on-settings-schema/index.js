"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeprecatedFontsOnSettingsSchema = void 0;
const types_1 = require("../../types");
const json_1 = require("../../json");
const deprecated_fonts_data_1 = require("../deprecated-fonts-on-sections-and-blocks/deprecated-fonts-data");
exports.DeprecatedFontsOnSettingsSchema = {
    meta: {
        code: 'DeprecatedFontsOnSettingsSchema',
        name: 'Check for deprecated fonts in settings_schema settings values',
        docs: {
            description: 'Warns on deprecated fonts in settings_schema settings values.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-fonts-on-settings-schema',
        },
        type: types_1.SourceCodeType.JSON,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        const relativePath = context.toRelativePath(context.file.uri);
        if (relativePath !== 'config/settings_schema.json')
            return {};
        return {
            async Property(node) {
                if (node.key.value === 'settings' && (0, types_1.isArrayNode)(node.value)) {
                    for (const setting of node.value.children) {
                        if ((0, types_1.isObjectNode)(setting)) {
                            const typeProperty = setting.children.find((prop) => prop.key.value === 'type');
                            if (typeProperty &&
                                typeProperty.value.type === 'Literal' &&
                                typeProperty.value.value === 'font_picker') {
                                // Check if this font_picker has a default value that's deprecated
                                const defaultProperty = setting.children.find((prop) => prop.key.value === 'default');
                                if (defaultProperty &&
                                    defaultProperty.value.type === 'Literal' &&
                                    typeof defaultProperty.value.value === 'string') {
                                    const defaultFont = defaultProperty.value.value;
                                    if (deprecated_fonts_data_1.DEPRECATED_FONT_HANDLES.has(defaultFont)) {
                                        context.report({
                                            message: `The font "${defaultFont}" is deprecated`,
                                            startIndex: (0, json_1.getLocStart)(defaultProperty.value),
                                            endIndex: (0, json_1.getLocEnd)(defaultProperty.value),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map