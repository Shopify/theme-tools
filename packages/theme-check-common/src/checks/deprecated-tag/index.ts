import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';

export const DeprecatedTag: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecatedTag',
    aliases: ['DeprecatedTags'],
    name: 'Deprecated Tag',
    docs: {
      description: 'This check is aimed at eliminating the use of deprecated tags.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-tag',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name === 'include') {
          const start = node.source.substring(node.position.start);
          const includeStartIndex = start.indexOf('include');
          const includeEndIndex = includeStartIndex + 'include'.length;

          const includeStart = node.position.start + includeStartIndex;
          const includeEnd = node.position.start + includeEndIndex;

          context.report({
            message: `Use the 'render' tag instead of 'include'`,
            startIndex: includeStart,
            endIndex: includeEnd,
            suggest: [
              {
                message: `Replace 'include' with 'render'`,
                fix: (corrector) => {
                  corrector.replace(includeStart, includeEnd, 'render');
                },
              },
            ],
          });
        }
      },
    };
  },
};
