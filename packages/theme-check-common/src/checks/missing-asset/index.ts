import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { doesFileExist } from '../../utils/file-utils';
import { isLiquidString } from '../utils';

export const MissingAsset: LiquidCheckDefinition = {
  meta: {
    code: 'MissingAsset',
    name: 'Avoid rendering missing asset files',
    docs: {
      description: 'Reports missing asset files',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-asset',
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

        let expression = node.expression;
        let originalAssetPath = `assets/${expression.value}`;
        let assetPath = originalAssetPath;

        let fileExists = await doesFileExist(context, assetPath);
        if (fileExists) return;

        if (assetPath.endsWith('.scss.css')) {
          assetPath = assetPath.replace('.scss.css', '.scss.liquid');
          fileExists = await doesFileExist(context, assetPath);
          if (fileExists) return;
        }

        if (assetPath.endsWith('.js') || assetPath.endsWith('.css')) {
          assetPath += '.liquid';
          fileExists = await doesFileExist(context, assetPath);
          if (fileExists) return;
        }

        context.report({
          message: `'${originalAssetPath}' does not exist`,
          startIndex: expression.position.start,
          endIndex: expression.position.end,
        });
      },
    };
  },
};
