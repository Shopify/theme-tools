import { parseJSON } from '../../json';
import {
  ConfigTarget,
  LiquidCheckDefinition,
  SchemaProp,
  Severity,
  SourceCodeType,
} from '../../types';
import { isError } from '../../utils';
import { doesFileExceedThreshold, doesFileExist } from '../../utils/file-utils';

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
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-app-block-css',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema,
    targets: [ConfigTarget.ThemeAppExtension],
  },

  create(context) {
    if (!context.fileSize) {
      return {};
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema') return;
        const schema = parseJSON(node.body.value);
        if (isError(schema)) return;
        const stylesheet = schema.stylesheet;
        if (!stylesheet) return;

        const relativePath = `assets/${stylesheet}`;
        const thresholdInBytes = context.settings.thresholdInBytes;

        const startIndex = node.body.position.start + node.body.value.indexOf(stylesheet);
        const endIndex = startIndex + stylesheet.length;

        const fileExists = await doesFileExist(context, relativePath);

        if (!fileExists) {
          context.report({
            message: `'${stylesheet}' does not exist.`,
            startIndex: startIndex,
            endIndex: endIndex,
          });
          return;
        }

        const [fileExceedsThreshold, fileSize] = await doesFileExceedThreshold(
          context,
          relativePath,
          thresholdInBytes,
        );

        if (fileExceedsThreshold) {
          context.report({
            message: `The file size for '${stylesheet}' (${fileSize} B) exceeds the configured threshold (${thresholdInBytes} B)`,
            startIndex: startIndex,
            endIndex: endIndex,
          });
        }
      },
    };
  },
};
