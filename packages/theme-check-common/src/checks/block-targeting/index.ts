import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const BlockTargeting: LiquidCheckDefinition = {
  meta: {
    code: 'BlockTargeting',
    name: 'Validate block targeting in presets',
    docs: {
      description:
        'Ensures preset blocks only reference valid block types and respect parent-child relationships',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/block-targeting',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const typeRegex = /"type":\s*"(\S+)"/g;

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const json = JSON.parse(jsonString);

        // Get all valid block types from root level
        const validBlockTypes = new Set<string>();
        if (json.blocks) {
          for (const block of json.blocks) {
            if (block.type) {
              validBlockTypes.add(block.type);
            }
          }
        }

        // Find all occurrences of block types in the JSON schema
        const findBlockTypes = (str: string) => {
          let match;
          const types = [];
          while ((match = typeRegex.exec(str)) !== null) {
            types.push({ type: match[1], index: match.index }); // Store both type and index
          }
          return types;
        };

        // Track reported block types to avoid duplicates
        const reportedTypes = new Set<string>();

        // Recursive function to validate blocks
        const validatePresetBlocks = (blocks: any[]) => {
          for (const block of blocks) {
            if (block.type) {
              // Check if block type is valid (either in schema blocks or @theme)
              const isPrivateBlockType = block.type.startsWith('_');
              if (
                !validBlockTypes.has(block.type) &&
                (isPrivateBlockType || !validBlockTypes.has('@theme')) &&
                !reportedTypes.has(block.type)
              ) {
                const occurrences = findBlockTypes(jsonString);
                for (const occurrence of occurrences) {
                  if (occurrence.type === block.type) {
                    const typePosition = occurrence.index;
                    const startIndex = node.blockStartPosition.end + typePosition + 8; // 8 = length of '"type": "'
                    const endIndex = startIndex + occurrence.type.length + 2; // 2 = length of '",'

                    context.report({
                      message: `Preset block type '${block.type}' is not valid`,
                      startIndex,
                      endIndex,
                    });

                    // Mark this type as reported
                    reportedTypes.add(block.type);
                  }
                }
              }

              // Recursively validate nested blocks
              if (block.blocks) {
                validatePresetBlocks(block.blocks);
              }
            }
          }
        };

        // Validate preset blocks
        if (json.presets) {
          for (const preset of json.presets) {
            if (preset.blocks) {
              validatePresetBlocks(preset.blocks);
            }
          }
        }
      },
    };
  },
};
