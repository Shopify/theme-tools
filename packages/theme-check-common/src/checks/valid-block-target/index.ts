import { JSONNode, LiquidCheckDefinition, Schema, Severity, SourceCodeType } from '../../types';
import { toJSONAST } from '../../to-source-code';
import { LiteralNode, ArrayNode } from 'json-to-ast';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { basename } from '../../path';
import { isBlock, isSection } from '../../to-schema';
import { Section } from '../../types/schemas/section';
import { Context } from '../../types';
import { doesFileExist } from '../../utils/file-utils';

type BlockNodeWithPath = {
  node: any;
  path: string[];
};

export const ValidBlockTarget: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockTarget',
    name: 'Validate block targeting in presets',
    docs: {
      description:
        'Ensures block types only reference valid block types and respect parent-child relationships',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-target',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
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

    function getBlocks(validSchema: any): {
      rootLevelThemeBlocks: BlockNodeWithPath[];
      rootLevelLocalBlocks: BlockNodeWithPath[];
      presetLevelBlocks: { [key: number]: BlockNodeWithPath[] };
    } {
      const rootLevelThemeBlocks: BlockNodeWithPath[] = [];
      const rootLevelLocalBlocks: BlockNodeWithPath[] = [];
      const presetLevelBlocks: { [key: number]: BlockNodeWithPath[] } = {};

      const rootLevelBlocks = validSchema.blocks;
      const presets = validSchema.presets;

      // Helper function to categorize blocks
      function categorizeRootLevelBlocks(block: any, index: number) {
        if (!block) return;
        const hasName = block.name !== undefined;

        if (hasName) {
          rootLevelLocalBlocks.push({
            node: block,
            path: ['blocks', String(index), 'type'],
          });
        } else if (block.type !== '@app') {
          rootLevelThemeBlocks.push({
            node: block,
            path: ['blocks', String(index), 'type'],
          });
        }
      }

      function categorizePresetLevelBlocks(block: any, currentPath: string[], depth: number = 0) {
        if (!block) return;

        // Initialize array for this depth if it doesn't exist
        if (!presetLevelBlocks[depth]) {
          presetLevelBlocks[depth] = [];
        }

        presetLevelBlocks[depth].push({
          node: block,
          path: [...currentPath, 'type'],
        });

        // Handle nested blocks
        if (block.blocks) {
          if (Array.isArray(block.blocks)) {
            block.blocks.forEach((nestedBlock: any, index: any) => {
              categorizePresetLevelBlocks(
                nestedBlock,
                [...currentPath, 'blocks', String(index)],
                depth + 1,
              );
            });
          } else if (typeof block.blocks === 'object') {
            Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
              categorizePresetLevelBlocks(nestedBlock, [...currentPath, 'blocks', key], depth + 1);
            });
          }
        }
      }

      // Iterate over rootLevelBlocks
      if (Array.isArray(rootLevelBlocks)) {
        rootLevelBlocks.forEach((block, index) => {
          categorizeRootLevelBlocks(block, index);
        });
      }

      if (presets) {
        presets.forEach((preset: any, presetIndex: number) => {
          if (preset.blocks) {
            if (Array.isArray(preset.blocks)) {
              preset.blocks.forEach((block: any, blockIndex: any) => {
                categorizePresetLevelBlocks(
                  block,
                  ['presets', String(presetIndex), 'blocks', String(blockIndex)],
                  0,
                );
              });
            } else if (typeof preset.blocks === 'object') {
              Object.entries(preset.blocks).forEach(([key, block]) => {
                categorizePresetLevelBlocks(
                  block,
                  ['presets', String(presetIndex), 'blocks', key],
                  0,
                );
              });
            }
          }
        });
      }

      return {
        rootLevelThemeBlocks,
        rootLevelLocalBlocks,
        presetLevelBlocks,
      };
    }

    async function validateBlockFileExistence(blockType: string): Promise<boolean> {
      if (blockType === '@theme' || blockType === '@app') {
        return true;
      }

      const blockPath = `blocks/${blockType}.liquid`;
      return await doesFileExist(context, blockPath);
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const offset = node.blockStartPosition.end;
        const schema = await getSchema();
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;
        if (!schema) return;

        const { rootLevelThemeBlocks, rootLevelLocalBlocks, presetLevelBlocks } =
          getBlocks(validSchema);

        if (rootLevelLocalBlocks.length > 0) return;

        let errorsInRootLevelBlocks = false;
        await Promise.all(
          rootLevelThemeBlocks.map(async ({ node, path }: BlockNodeWithPath) => {
            const typeNode = nodeAtPath(ast, path);
            if (!typeNode) return;

            const exists = await validateBlockFileExistence(node.type);
            if (!exists) {
              errorsInRootLevelBlocks = true;
              context.report({
                message: `Theme block 'blocks/${node.type}.liquid' does not exist.`,
                startIndex: offset + getLocStart(typeNode),
                endIndex: offset + getLocEnd(typeNode),
              });
            }
          }),
        );

        if (errorsInRootLevelBlocks) return;

        for (const [depthStr, blocks] of Object.entries(presetLevelBlocks)) {
          const depth = parseInt(depthStr, 10);

          if (depth === 0) {
            await Promise.all(
              blocks.map(async ({ node, path }: BlockNodeWithPath) => {
                const typeNode = nodeAtPath(ast, path);
                if (!typeNode) return;

                const isPrivateBlockType = node.type.startsWith('_');
                const isThemeInRootLevel = rootLevelThemeBlocks.some(
                  (block) => block.node.type === '@theme',
                );
                const needsExplicitRootBlock = isPrivateBlockType || !isThemeInRootLevel;
                const isPresetInRootLevel = rootLevelThemeBlocks.some(
                  (block) => block.node.type === node.type,
                );

                if (!isPresetInRootLevel && needsExplicitRootBlock) {
                  const errorMessage = isPrivateBlockType
                    ? `Theme block type "${node.type}" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.`
                    : `Theme block type "${node.type}" must be allowed in "blocks" at the root of this schema.`;
                  context.report({
                    message: errorMessage,
                    startIndex: offset + getLocStart(typeNode),
                    endIndex: offset + getLocEnd(typeNode),
                  });
                } else {
                  const exists = await validateBlockFileExistence(node.type);
                  if (!exists) {
                    context.report({
                      message: `Theme block 'blocks/${node.type}.liquid' does not exist.`,
                      startIndex: offset + getLocStart(typeNode),
                      endIndex: offset + getLocEnd(typeNode),
                    });
                  }
                }
              }),
            );
          } else {
            blocks.forEach(({ node, path }: BlockNodeWithPath) => {
              const typeNode = nodeAtPath(ast, path);
              if (typeNode) {
                console.log(`Level ${depth} block:`, node.type);
              }
            });
          }
        }
      },
    };
  },
};
