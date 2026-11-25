import { JSONCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getLocStart, getLocEnd } from '../../json';
import { DEPRECATED_FONT_HANDLES } from '../deprecated-fonts-on-sections-and-blocks/deprecated-fonts-data';

export const DeprecatedFontsOnSettingsData: JSONCheckDefinition = {
  meta: {
    code: 'DeprecatedFontsOnSettingsData',
    name: 'Check for deprecated fonts in settings_data settings values',
    docs: {
      description: 'Warns on deprecated fonts in settings_data settings values.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-fonts-on-settings-data',
    },
    type: SourceCodeType.JSON,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (relativePath !== 'config/settings_data.json') return {};

    return {
      async Property(node) {
        if (
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string' &&
          DEPRECATED_FONT_HANDLES.has(node.value.value)
        ) {
          context.report({
            message: `The font "${node.value.value}" is deprecated`,
            startIndex: getLocStart(node.value),
            endIndex: getLocEnd(node.value),
          });
        }
      },
    };
  },
};
