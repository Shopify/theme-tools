import { LiquidCheckDefinition, Section, Severity, SourceCodeType, ThemeBlock } from '../../types';
import { LiteralNode } from 'json-to-ast';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { basename } from '../../path';
import { isBlock, isSection } from '../../to-schema';

type BlockNodeWithPath = {
  node: Section.Block | ThemeBlock.Block;
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

    function getBlocks(validSchema: ThemeBlock.Schema | Section.Schema): {
      staticBlockNameLocations: BlockNodeWithPath[];
      staticBlockLocations: BlockNodeWithPath[];
      localBlockLocations: BlockNodeWithPath[];
      themeBlockLocations: BlockNodeWithPath[];
      hasRootLevelThemeBlocks: boolean;
    } {
      const staticBlockNameLocations: BlockNodeWithPath[] = [];
      const staticBlockLocations: BlockNodeWithPath[] = [];
      const localBlockLocations: BlockNodeWithPath[] = [];
      const themeBlockLocations: BlockNodeWithPath[] = [];

      const rootLevelBlocks = validSchema.blocks;
      const presets = validSchema.presets;
      // Helper function to categorize blocks
      function categorizeBlock(block: Section.Block | ThemeBlock.Block, currentPath: string[]) {
        if (!block) return;
        const hasStatic = 'static' in block;
        const hasName = 'name' in block;

        if (hasStatic && hasName) {
          staticBlockNameLocations.push({ node: block, path: currentPath.concat('type') });
        } else if (hasStatic) {
          staticBlockLocations.push({ node: block, path: currentPath.concat('type') });
        } else if (hasName) {
          localBlockLocations.push({ node: block, path: currentPath.concat('type') });
        } else if (block.type !== '@app') {
          themeBlockLocations.push({ node: block, path: currentPath.concat('type') });
        }

        // Handle nested blocks
        if ('blocks' in block) {
          if (Array.isArray(block.blocks)) {
            block.blocks.forEach((nestedBlock: Section.Block | ThemeBlock.Block, index: number) => {
              categorizeBlock(nestedBlock, currentPath.concat('blocks', String(index)));
            });
          } else if (typeof block.blocks === 'object' && block.blocks !== null) {
            Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
              categorizeBlock(nestedBlock, currentPath.concat('blocks', key));
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
        presets.forEach((preset: ThemeBlock.Preset | Section.Preset, presetIndex: number) => {
          if (preset.blocks) {
            if (Array.isArray(preset.blocks)) {
              preset.blocks.forEach((block: Section.Block, blockIndex: number) => {
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
        hasRootLevelThemeBlocks: themeBlockLocations.some((block) => block.path[0] === 'blocks'),
      };
    }

    function reportWarning(message: string, offset: number, astNode: LiteralNode) {
      context.report({
        message,
        startIndex: offset + getLocStart(astNode),
        endIndex: offset + getLocEnd(astNode),
      });
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
          hasRootLevelThemeBlocks,
        } = getBlocks(validSchema);

        if (isSection(context.file.uri)) {
          staticBlockNameLocations.forEach((blockWithPath: BlockNodeWithPath) => {
            const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
            reportWarning('Static theme blocks cannot have a name property.', offset, astNode);
          });

          if (staticBlockLocations.length > 0 && localBlockLocations.length > 0) {
            staticBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              reportWarning(
                `Sections cannot use static theme blocks together with locally scoped blocks.`,
                offset,
                astNode,
              );
            });
          }

          if (
            hasRootLevelThemeBlocks &&
            localBlockLocations.length > 0 &&
            themeBlockLocations.length > 0
          ) {
            localBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              reportWarning(
                'Sections cannot use theme blocks together with locally scoped blocks.',
                offset,
                astNode,
              );
            });
          }
        }

        if (isBlock(context.file.uri)) {
          if (localBlockLocations.length > 0) {
            localBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              reportWarning(
                'Local scoped blocks are not supported in theme blocks.',
                offset,
                astNode,
              );
            });
          }
        }
      },
    };
  },
};
