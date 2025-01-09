import { ConfigTarget, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

import { hasAttributeValueOf, isAttr, isValuedHtmlAttribute } from '../utils';

export const NoImportmap: LiquidCheckDefinition = {
  meta: {
    code: 'NoImportmap',
    name: 'Import map in theme app extensions',
    docs: {
      description:
        'Report offenses associated with import maps on script tags in theme app extensions',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/no-importmap',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [ConfigTarget.ThemeAppExtension],
  },

  create(context) {
    return {
      async HtmlRawNode(node) {
        if (node.name !== 'script') {
          return;
        }

        const typeImportMap = node.attributes
          .filter(isValuedHtmlAttribute)
          .some((attr) => isAttr(attr, 'type') && hasAttributeValueOf(attr, 'importmap'));

        const typeModule = node.attributes
          .filter(isValuedHtmlAttribute)
          .some((attr) => isAttr(attr, 'type') && hasAttributeValueOf(attr, 'importmap'));

        if (!typeImportMap || !typeModule) {
          return;
        }

        context.report({
          message:
            'Until browsers permit multiple importmap entries, only themes can have an importmap',
          startIndex: node.position.start,
          endIndex: node.position.end,
          suggest: [
            {
              message: `Remove the 'importmap' script tag`,
              fix: (corrector) => corrector.remove(node.position.start, node.position.end),
            },
          ],
        });
      },
    };
  },
};
