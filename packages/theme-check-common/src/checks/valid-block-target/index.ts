import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { doesFileExist } from '../../utils/file-utils';

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
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json' || !context.parseJSON) {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const json = JSON.parse(jsonString);
        const jsonDocument = context.parseJSON(context.file, jsonString);
        if (!jsonDocument || !jsonDocument.root) {
          return;
        }

        async function checkBlockFileExistence(blockType: string, locations: Location[]) {
          // Skip check for theme/app blocks
          if (blockType.startsWith('@')) {
            return;
          }

          const blockPath = `blocks/${blockType}.liquid`;
          const exists = await doesFileExist(context, blockPath);
          if (!exists) {
            for (const [startIndex, length] of locations) {
              context.report({
                message: `Block file '${blockPath}' does not exist`,
                startIndex: node.blockStartPosition.end + startIndex,
                endIndex: node.blockStartPosition.end + startIndex + length,
              });
            }
          }
        }

        function collectBlockTypes(node: any, typeMap: BlockTypeMap) {
          // Base case: if node isn't an object or doesn't have properties, return
          if (!node || node.type !== 'object' || !node.properties) {
            return;
          }

          // Check for type property
          for (const prop of node.properties) {
            if (prop.keyNode?.value === 'type' && prop.valueNode?.value) {
              const blockType = prop.valueNode.value;
              if (typeof blockType === 'string') {
                const existingLocations = typeMap.get(blockType) || [];
                typeMap.set(blockType, [
                  ...existingLocations,
                  [prop.valueNode.offset, prop.valueNode.length],
                ]);
              }
            }

            // Recursively check blocks property
            if (
              prop.keyNode?.value === 'blocks' &&
              prop.valueNode?.type === 'array' &&
              prop.valueNode.items
            ) {
              for (const block of prop.valueNode.items) {
                collectBlockTypes(block, typeMap);
              }
            }
          }
        }

        // Get root level blocks and preset blocks
        type Location = [number, number]; // [offset, length]
        type BlockTypeMap = Map<string, Location[]>;
        const rootLevelBlockTypes: BlockTypeMap = new Map();
        const presetBlockTypes: BlockTypeMap = new Map();

        if (jsonDocument.root && jsonDocument.root.type === 'object') {
          for (const property of jsonDocument.root.properties) {
            // Collect root-level blocks
            if (property.keyNode?.value === 'blocks' && property.valueNode?.type === 'array') {
              for (const block of property.valueNode.items || []) {
                collectBlockTypes(block, rootLevelBlockTypes);
              }
            }

            // Collect preset blocks
            if (property.keyNode?.value === 'presets' && property.valueNode?.type === 'array') {
              for (const preset of property.valueNode.items || []) {
                collectBlockTypes(preset, presetBlockTypes);
              }
            }
          }
        }

        // Ensure blocks are targeting valid root-level blocks or private blocks
        for (const [presetType, presetLocations] of presetBlockTypes.entries()) {
          const isPrivateBlockType = presetType.startsWith('_');
          // Check if preset block types reference valid root-level blocks
          if (
            !rootLevelBlockTypes.has(presetType) &&
            (isPrivateBlockType || !rootLevelBlockTypes.has('@theme'))
          ) {
            // Iterate through all locations for this preset type
            for (const [startIndex, length] of presetLocations) {
              context.report({
                message: `Preset block type "${presetType}" does not reference a valid root-level block type`,
                startIndex: node.blockStartPosition.end + startIndex,
                endIndex: node.blockStartPosition.end + startIndex + length,
              });
            }
          } else {
            await checkBlockFileExistence(presetType, presetLocations);
          }
        }

        // Ensure that block liquid file exists
        for (const [blockType, locations] of rootLevelBlockTypes) {
          await checkBlockFileExistence(blockType, locations);
        }
      },
    };
  },
};
