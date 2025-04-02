import { isSnippet, isBlock } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { filePathSupportsLiquidDoc } from '../../liquid-doc/utils';

export const UnsupportedDocTag: LiquidCheckDefinition = {
  meta: {
    code: 'UnsupportedDocTag',
    name: 'Prevent unsupported doc tag usage',
    docs: {
      description: 'This check exists to prevent use of `doc` tag outside of snippet file.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unsupported-doc-tag',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const docTagName = 'doc';

    if (filePathSupportsLiquidDoc(context.file.uri)) {
      return {};
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== docTagName) {
          return;
        }
        context.report({
          message: `The \`${docTagName}\` tag can only be used within a snippet or block.`,
          startIndex: node.position.start,
          endIndex: node.position.end,
          suggest: [
            {
              message: `Remove unsupported \`${docTagName}\` tag`,
              fix: (corrector) => corrector.remove(node.position.start, node.position.end),
            },
          ],
        });
      },
    };
  },
};
