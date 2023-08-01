import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { assertFileExists } from '../../utils/file-utils';
import { isLiquidString } from '../utils';

export const MissingAsset: LiquidCheckDefinition = {
  meta: {
    code: 'MissingAsset',
    name: 'Avoid rendering missing asset files',
    docs: {
      description: 'Reports missing asset files',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/missing-asset',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidVariable(node) {
        if (node.filters.length === 0 || node.filters[0].name !== 'asset_url') {
          return;
        }

        if (!isLiquidString(node.expression)) return;

        const expression = node.expression;
        const assetPath = `assets/${expression.value}`;
        const fileExists = await assertFileExists(context, assetPath);
        if (fileExists) return;

        context.report({
          message: `'${assetPath}' does not exist`,
          startIndex: expression.position.start,
          endIndex: expression.position.end,
        });
      },
    };
  },
};
