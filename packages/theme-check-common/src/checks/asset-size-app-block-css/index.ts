import { LiquidCheckDefinition, SchemaProp, Severity, SourceCodeType } from '../../types';
import { assertFileExists, assertFileSize } from '../../utils/file-utils';

const schema = {
  thresholdInBytes: SchemaProp.number(100000),
};

export const AssetSizeAppBlockCSS: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'AssetSizeAppBlockCSS',
    name: 'Asset Size App Block CSS',
    docs: {
      description:
        'This check is aimed at preventing large CSS bundles from being included via Theme App Extensions.',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/asset-size-app-block-css',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    if (!context.fileSize) {
      return {};
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema') return;
        let filePath;
        try {
          filePath = JSON.parse(node.body.value).stylesheet;
        } catch (error) {
          return;
        }

        if (!filePath) {
          return;
        }

        const absolutePath = `assets/${filePath}`;
        const thresholdInBytes = context.settings.thresholdInBytes;

        const startIndex = node.body.position.start + node.body.value.indexOf(filePath);
        const endIndex = startIndex + filePath.length;

        const fileExists = await assertFileExists(context, absolutePath);

        if (!fileExists) {
          context.report({
            message: `'${filePath}' does not exist.`,
            startIndex: startIndex,
            endIndex: endIndex,
          });
          return;
        }

        const fileExceedsThreshold = await assertFileSize(context, absolutePath, thresholdInBytes);

        if (fileExceedsThreshold) {
          context.report({
            message: `The file size for '${filePath}' exceeds the configured threshold.`,
            startIndex: startIndex,
            endIndex: endIndex,
          });
        }
      },
    };
  },
};
