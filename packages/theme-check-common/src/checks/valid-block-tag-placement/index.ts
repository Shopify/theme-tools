import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { blockTagSyntaxError } from '../liquid-syntax-error/block';

const TEMPLATE_FILE_PATTERN = /^templates\/(?:[^/]+\/)*[^/]+\.liquid$/;
const LAYOUT_FILE_PATTERN = /^layout\/[^/]+\.liquid$/;
const MESSAGE = "The 'block' tag can only be used in templates/**/*.liquid and layout/*.liquid.";

export const ValidBlockTagPlacement: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockTagPlacement',
    name: 'Valid Block Tag Placement',
    docs: {
      description: "Reports uses of the 'block' tag outside Liquid templates and layouts.",
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-tag-placement',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    const isAllowedFile =
      TEMPLATE_FILE_PATTERN.test(relativePath) || LAYOUT_FILE_PATTERN.test(relativePath);

    return {
      async LiquidTag(node) {
        if (node.name !== 'block' || blockTagSyntaxError(node) || isAllowedFile) return;

        context.report({
          message: MESSAGE,
          startIndex: node.position.start,
          endIndex: node.position.end,
        });
      },
    };
  },
};
