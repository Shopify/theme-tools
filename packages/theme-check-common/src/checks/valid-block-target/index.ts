import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { hasLocalBlocks, collectBlockTypes, validateBlockFileExistence } from './block-utils';

type Location = [number, number]; // [offset, length]

export const ValidBlockTarget: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockTarget',
    name: 'Validate block targeting in presets',
    docs: {
      description:
        'Ensures block types only reference valid block types and respect parent-child relationships',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-block-target',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    const isSection = relativePath.startsWith('sections/');
    const isThemeBlock = relativePath.startsWith('blocks/');

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json' || !context.parseJSON) {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const jsonDocument = context.parseJSON(context.file, jsonString);
        if (!jsonDocument || !jsonDocument.root) {
          return;
        }

        // Check for local blocks
        const { found: localBlocksExist, locations: localBlockLocations } = hasLocalBlocks(
          jsonDocument.root,
        );

        // Skip validation for section files with local blocks
        if (isSection && localBlocksExist) {
          return;
        }

        // Check for local blocks in theme blocks
        if (isThemeBlock && localBlocksExist) {
          for (const [startIndex, length] of localBlockLocations) {
            context.report({
              message: `Local scoped blocks are not supported in theme blocks.`,
              startIndex: node.blockStartPosition.end + startIndex,
              endIndex: node.blockStartPosition.end + startIndex + length,
            });
          }
          return;
        }

        // Collect root level block types
        const rootLevelBlockTypes: { [key: string]: Location[] } = {};
        if (jsonDocument.root?.type === 'object') {
          const blocksProperty = jsonDocument.root.properties.find(
            (p) => p.keyNode?.value === 'blocks',
          );

          if (blocksProperty?.valueNode?.type === 'array') {
            for (const block of blocksProperty.valueNode.items || []) {
              collectBlockTypes(block, rootLevelBlockTypes);
            }
          }
        }

        // Validate existence of root level block types
        let errorsInRootLevelBlocks = false;
        for (const blockType in rootLevelBlockTypes) {
          const locations = rootLevelBlockTypes[blockType];
          const exists = await validateBlockFileExistence(blockType, context);
          if (!exists) {
            for (const [startIndex, length] of locations) {
              context.report({
                message: `Theme block 'blocks/${blockType}.liquid' does not exist.`,
                startIndex: node.blockStartPosition.end + startIndex,
                endIndex: node.blockStartPosition.end + startIndex + length,
              });
            }
            errorsInRootLevelBlocks = true;
          }
        }

        // If no errors in root level blocks, proceed to collect preset block types
        if (!errorsInRootLevelBlocks) {
          const presetBlockTypes: { [key: string]: Location[] } = {};
          if (jsonDocument.root?.type === 'object') {
            const presetsProperty = jsonDocument.root.properties.find(
              (p) => p.keyNode?.value === 'presets',
            );

            if (presetsProperty?.valueNode?.type === 'array') {
              for (const preset of presetsProperty.valueNode.items || []) {
                collectBlockTypes(preset, presetBlockTypes);
              }
            }
          }

          // Validate existence of preset block types
          for (const presetType in presetBlockTypes) {
            const presetLocations = presetBlockTypes[presetType];
            const isPrivateBlockType = presetType.startsWith('_');
            const isPresetInRootLevel = presetType in rootLevelBlockTypes;
            const isThemeInRootLevel = '@theme' in rootLevelBlockTypes;
            const needsExplicitRootBlock = isPrivateBlockType || !isThemeInRootLevel;

            if (!isPresetInRootLevel && needsExplicitRootBlock) {
              const errorMessage = isPrivateBlockType
                ? `Theme block type "${presetType}" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.`
                : `Theme block type "${presetType}" must be allowed in "blocks" at the root of this schema.`;

              presetLocations.forEach(([startIndex, length]) => {
                context.report({
                  message: errorMessage,
                  startIndex: node.blockStartPosition.end + startIndex,
                  endIndex: node.blockStartPosition.end + startIndex + length,
                });
              });
            } else {
              const exists = await validateBlockFileExistence(presetType, context);
              if (!exists) {
                for (const [startIndex, length] of presetLocations) {
                  context.report({
                    message: `Theme block 'blocks/${presetType}.liquid' does not exist.`,
                    startIndex: node.blockStartPosition.end + startIndex,
                    endIndex: node.blockStartPosition.end + startIndex + length,
                  });
                }
              }
            }
          }
        }
      },
    };
  },
};
