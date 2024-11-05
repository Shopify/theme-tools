import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { Context, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { doesFileExist } from '../../utils/file-utils';

export const ValidBlock: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlock',
    name: 'Validate block file references in schemas',
    docs: {
      description: 'Reports missing block files referenced in section schema and preset blocks',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );
        const ast = JSON.parse(jsonString);

        // Helper function to process blocks
        const processBlocks = async (blocks: any) => {
          for (const block of blocks) {
            // For regular blocks, check for specific types to ignore
            if (blocks === ast.blocks && (block.type === '@app' || block.type === '@theme')) {
              continue; // Skip @app and @theme for regular blocks
            }

            if (block.type) {
              const blockPath = `blocks/${block.type}.liquid`;
              const exists = await doesFileExist(context, blockPath);

              if (!exists) {
                // Find the position of the block type in the JSON string
                const typePosition = jsonString.indexOf(`"type": "${block.type}"`);
                if (typePosition >= 0) {
                  // Calculate start and end index for underlining the block type
                  const startIndex = node.blockStartPosition.end + typePosition + 8; // 8 = length of '"type": "'
                  const endIndex = startIndex + block.type.length + 2; // +2 for potential surrounding quotes
                  context.report({
                    message: `Block file '${blockPath}' does not exist`,
                    startIndex: startIndex,
                    endIndex: endIndex,
                  });
                }
              }
            }
          }
        };

        // Handle blocks in the schema
        if (ast.blocks) {
          await processBlocks(ast.blocks);
        }

        // Handle preset blocks
        if (ast.presets) {
          for (const preset of ast.presets) {
            if (preset.blocks) {
              await processBlocks(preset.blocks);
            }
          }
        }
      },
    };
  },
};
