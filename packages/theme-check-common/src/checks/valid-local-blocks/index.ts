import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiteralNode, ArrayNode } from 'json-to-ast';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { basename } from '../../path';
import { isBlock, isSection } from '../../to-schema';
import { Section } from '../../types/schemas/section';
import { Context } from '../../types';

type BlockNodeWithPath = {
  node: any;
  path: string[];
};

export const ValidLocalBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'ValidLocalBlocks',
    name: 'Prevent mixing static and local blocks in non-theme sections',
    docs: {
      description:
        'Ensures sections without theme block support do not mix static and local blocks',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-local-blocks',
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
      staticBlockNameLocations: BlockNodeWithPath[];
      staticBlockLocations: BlockNodeWithPath[];
      localBlockLocations: BlockNodeWithPath[];
      themeBlockLocations: BlockNodeWithPath[];
    } {
      const staticBlockNameLocations: BlockNodeWithPath[] = [];
      const staticBlockLocations: BlockNodeWithPath[] = [];
      const localBlockLocations: BlockNodeWithPath[] = [];
      const themeBlockLocations: BlockNodeWithPath[] = [];

      const rootLevelBlocks = validSchema.blocks;
      const presets = validSchema.presets;

      // Helper function to categorize blocks
      function categorizeBlock(block: any, currentPath: string[]) {
        if (!block) return;
        const hasStatic = block.static !== undefined;
        const hasName = block.name !== undefined;

        if (hasStatic && hasName) {
          staticBlockNameLocations.push({ node: block, path: [...currentPath, 'type'] });
        } else if (hasStatic) {
          staticBlockLocations.push({ node: block, path: [...currentPath, 'type'] });
        } else if (hasName) {
          localBlockLocations.push({ node: block, path: [...currentPath, 'type'] });
        } else if (block.type !== '@app') {
          themeBlockLocations.push({ node: block, path: [...currentPath, 'type'] });
        }

        // Handle nested blocks
        if (block.blocks) {
          if (Array.isArray(block.blocks)) {
            block.blocks.forEach((nestedBlock: any, index: any) => {
              categorizeBlock(nestedBlock, [...currentPath, 'blocks', String(index)]);
            });
          } else if (typeof block.blocks === 'object') {
            Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
              categorizeBlock(nestedBlock, [...currentPath, 'blocks', key]);
            });
          }
        }
      }

      // Iterate over rootLevelBlocks
      if (Array.isArray(rootLevelBlocks)) {
        rootLevelBlocks.forEach((block, index) => {
          categorizeBlock(block, ['blocks', String(index)]);
        });
      }

      // Iterate over presetLevelBlocks
      if (presets) {
        presets.forEach((preset: any, presetIndex: number) => {
          if (preset.blocks) {
            if (Array.isArray(preset.blocks)) {
              preset.blocks.forEach((block: any, blockIndex: any) => {
                categorizeBlock(block, [
                  'presets',
                  String(presetIndex),
                  'blocks',
                  String(blockIndex),
                ]);
              });
            } else if (typeof preset.blocks === 'object') {
              Object.entries(preset.blocks).forEach(([key, block]) => {
                categorizeBlock(block, ['presets', String(presetIndex), 'blocks', key]);
              });
            }
          }
        });
      }

      return {
        staticBlockNameLocations,
        staticBlockLocations,
        localBlockLocations,
        themeBlockLocations,
      };
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

        const {
          staticBlockNameLocations,
          staticBlockLocations,
          localBlockLocations,
          themeBlockLocations,
        } = getBlocks(validSchema);

        if (isSection(context.file.uri)) {
          staticBlockNameLocations.forEach((blockWithPath: BlockNodeWithPath) => {
            const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
            context.report({
              message: 'Static theme blocks cannot have a name property.',
              startIndex: offset + getLocStart(astNode),
              endIndex: offset + getLocEnd(astNode),
            });
          });

          if (staticBlockLocations.length > 0 && localBlockLocations.length > 0) {
            staticBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              context.report({
                message: `Sections cannot use static theme blocks together with locally scoped blocks.`,
                startIndex: offset + getLocStart(astNode),
                endIndex: offset + getLocEnd(astNode),
              });
            });
          }

          if (localBlockLocations.length > 0 && themeBlockLocations.length > 0) {
            localBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              context.report({
                message: 'Sections cannot use theme blocks together with locally scoped blocks.',
                startIndex: offset + getLocStart(astNode),
                endIndex: offset + getLocEnd(astNode),
              });
            });
          }
        }

        const my_test = nodeAtPath(ast, ['blocks', 0, 'type'])! as LiteralNode;
        const my_test_start = getLocStart(my_test);
        const my_test_end = getLocEnd(my_test);
        if (isBlock(context.file.uri)) {
          if (localBlockLocations.length > 0) {
            localBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              context.report({
                message: 'Local scoped blocks are not supported in theme blocks.',
                startIndex: offset + getLocStart(astNode),
                endIndex: offset + getLocEnd(astNode),
              });
            });
          }
        }
      },
    };
  },
};
