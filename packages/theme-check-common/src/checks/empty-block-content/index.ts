import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isBlock, isSection } from '../../to-schema';
import { basename } from '../../path';

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
    function getSchema() {
      const name = basename(context.file.uri, '.liquid');
      switch (true) {
        case isBlock(context.file.uri):
          return context.getBlockSchema?.(name);
        case isSection(context.file.uri):
          return context.getSectionSchema?.(name);
        default:
          return undefined;
      }
    }

    let contentForBlocksLocation: { start: number; end: number } | undefined;
    return {
      async LiquidTag(node) {
        if (node.name !== 'content_for') return;

        const nodeMarkup = node.markup;
        if (typeof nodeMarkup === 'object' && nodeMarkup.contentForType.value === 'blocks') {
          contentForBlocksLocation = {
            start: node.blockStartPosition.start,
            end: node.blockStartPosition.end,
          };
        }
      },

      async onCodePathEnd() {
        const schema = await getSchema();
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const blocks = validSchema.blocks;
        if (contentForBlocksLocation && blocks && blocks.length === 0) {
          context.report({
            message: "The 'content_for blocks' tag is present, but the blocks array is empty.",
            startIndex: contentForBlocksLocation.start,
            endIndex: contentForBlocksLocation.end,
          });
        }
      },
    };
  },
};
