import {
  JSONCheckDefinition,
  Severity,
  SourceCodeType,
  isArrayNode,
  isObjectNode,
} from '../../types';
import { getLocStart, getLocEnd } from '../../json';
import { DEPRECATED_FONT_HANDLES } from '../deprecated-fonts-on-sections-and-blocks/deprecated-fonts-data';

export const DeprecatedFontsOnSettingsSchema: JSONCheckDefinition = {
  meta: {
    code: 'DeprecatedFontsOnSettingsSchema',
    name: 'Check for deprecated fonts in settings_schema settings values',
    docs: {
      description: 'Warns on deprecated fonts in settings_schema settings values.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-fonts-on-settings-schema',
    },
    type: SourceCodeType.JSON,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (relativePath !== 'config/settings_schema.json') return {};

    return {
      async Property(node) {
        if (node.key.value === 'settings' && isArrayNode(node.value)) {
          for (const setting of node.value.children) {
            if (isObjectNode(setting)) {
              const typeProperty = setting.children.find((prop) => prop.key.value === 'type');
              if (
                typeProperty &&
                typeProperty.value.type === 'Literal' &&
                typeProperty.value.value === 'font_picker'
              ) {
                // Check if this font_picker has a default value that's deprecated
                const defaultProperty = setting.children.find(
                  (prop) => prop.key.value === 'default',
                );
                if (
                  defaultProperty &&
                  defaultProperty.value.type === 'Literal' &&
                  typeof defaultProperty.value.value === 'string'
                ) {
                  const defaultFont = defaultProperty.value.value;
                  if (DEPRECATED_FONT_HANDLES.has(defaultFont)) {
                    context.report({
                      message: `The font "${defaultFont}" is deprecated`,
                      startIndex: getLocStart(defaultProperty.value),
                      endIndex: getLocEnd(defaultProperty.value),
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
