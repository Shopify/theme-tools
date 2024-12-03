import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getSchema } from '../../to-schema';
import { Position } from '@shopify/liquid-html-parser';

export const EmptyBlockContent: LiquidCheckDefinition = {
  meta: {
    code: 'EmptyBlockContent',
    name: 'Prevent empty block content',
    docs: {
      description:
        'This check exists to warn you when the blocks array at the root level of the schema is empty.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/empty-block-content',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    let isContentForBlocksLocationSet = false;
    let contentForBlocksLocation: Position = { start: 0, end: 0 };

    return {
      async LiquidTag(node) {
        if (node.name !== 'content_for') return;

        const nodeMarkup = node.markup;
        if (typeof nodeMarkup === 'object' && nodeMarkup.contentForType.value === 'blocks') {
          contentForBlocksLocation.start = node.blockStartPosition.start;
          contentForBlocksLocation.end = node.blockStartPosition.end;
          isContentForBlocksLocationSet = true;
        }
      },

      async onCodePathEnd() {
        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const blocks = validSchema.blocks;
        if (isContentForBlocksLocationSet && !blocks) {
          context.report({
            message: `The 'content_for "blocks"' tag is present, but the blocks array is not defined.`,
            startIndex: contentForBlocksLocation.start,
            endIndex: contentForBlocksLocation.end,
          });
        } else if (isContentForBlocksLocationSet && blocks && blocks.length === 0) {
          context.report({
            message: `The 'content_for "blocks"' tag is present, but the blocks array is empty.`,
            startIndex: contentForBlocksLocation.start,
            endIndex: contentForBlocksLocation.end,
          });
        }
      },
    };
  },
};
