import { parseJSON } from '../../json';
import {
  ConfigTarget,
  LiquidCheckDefinition,
  SchemaProp,
  Severity,
  SourceCodeType,
} from '../../types';
import { isError } from '../../utils';
import { doesFileExist, doesFileExceedThreshold } from '../../utils/file-utils';

const schema = {
  thresholdInBytes: SchemaProp.number(10000),
};

export const AssetSizeAppBlockJavaScript: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'AssetSizeAppBlockJavaScript',
    name: 'Asset Size App Block JavaScript',
    docs: {
      description:
        'This check is aimed at preventing large JavaScript bundles from being included via Theme App Extensions.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/asset-size-app-block-javascript',
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
        const javascript = schema.javascript;
        if (!javascript) return;

        const relativePath = `assets/${javascript}`;
        const thresholdInBytes = context.settings.thresholdInBytes;

        const startIndex = node.body.position.start + node.body.value.indexOf(javascript);
        const endIndex = startIndex + javascript.length;

        const fileExists = await doesFileExist(context, relativePath);

        if (!fileExists) {
          context.report({
            message: `'${javascript}' does not exist.`,
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
            message: `The file size for '${javascript}' (${fileSize} B) exceeds the configured threshold (${thresholdInBytes} B)`,
            startIndex: startIndex,
            endIndex: endIndex,
          });
        }
      },
    };
  },
};
