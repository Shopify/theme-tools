import { LiquidRawTag } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import {
  LiquidCheckDefinition,
  RelativePath,
  SchemaProp,
  Severity,
  SourceCodeType,
} from '../../types';

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
    const thresholdInBytes = context.settings.thresholdInBytes;

    async function verifyFile(filePath: RelativePath, node: LiquidRawTag) {
      const absolutePath = context.absolutePath(`assets/${filePath}`);

      const startIndex = node.body.position.start + node.body.value.indexOf(filePath);
      const endIndex = startIndex + filePath.length - 1;

      const fileExists = await context.fileExists(absolutePath);
      if (!fileExists) {
        context.report({
          message: `'${filePath}' does not exist.`,
          startIndex: startIndex,
          endIndex: endIndex,
        });
        return;
      }
      const fileSize = await context.fileSize!(absolutePath);

      if (fileSize <= thresholdInBytes) return;

      context.report({
        message: `The CSS file size exceeds the configured threshold.`,
        startIndex: startIndex,
        endIndex: endIndex,
      });
      return;
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema') return;
        try {
          const stylesheetPath = JSON.parse(node.body.value).stylesheet;
          if (stylesheetPath) {
            await verifyFile(stylesheetPath, node);
          }
        } catch (error) {
          return;
        }
      },
    };
  },
};
