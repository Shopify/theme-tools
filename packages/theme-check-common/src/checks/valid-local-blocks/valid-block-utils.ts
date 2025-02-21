import { getLocEnd, getLocStart } from '../../json';
import { Preset, ThemeBlock, Section, Context, SourceCodeType, LiteralNode } from '../../types';

type BlockNodeWithPath = {
  node: Section.Block | ThemeBlock.Block | Preset.Block;
  path: string[];
};

export function getBlocks(validSchema: ThemeBlock.Schema | Section.Schema): {
  staticBlockLocations: BlockNodeWithPath[];
  localBlockLocations: BlockNodeWithPath[];
  themeBlockLocations: BlockNodeWithPath[];
  hasRootLevelThemeBlocks: boolean;
} {
  const staticBlockLocations: BlockNodeWithPath[] = [];
  const localBlockLocations: BlockNodeWithPath[] = [];
  const themeBlockLocations: BlockNodeWithPath[] = [];

  const rootLevelBlocks = validSchema.blocks;
  const presets = validSchema.presets;

  function categorizeBlock(
    block: Section.Block | ThemeBlock.Block | Preset.Block,
    currentPath: string[],
    inPreset: boolean = false,
  ) {
    if (!block) return;
    const hasStatic = 'static' in block;
    const hasName = 'name' in block;

    if (hasStatic) {
      staticBlockLocations.push({ node: block, path: currentPath.concat('type') });
    } else if (hasName && !inPreset) {
      localBlockLocations.push({ node: block, path: currentPath.concat('type') });
    } else if (block.type !== '@app') {
      themeBlockLocations.push({ node: block, path: currentPath.concat('type') });
    }

    if ('blocks' in block) {
      if (Array.isArray(block.blocks)) {
        block.blocks.forEach((nestedBlock: Preset.PresetBlockForArray, index: number) => {
          categorizeBlock(nestedBlock, currentPath.concat('blocks', String(index)), inPreset);
        });
      } else if (typeof block.blocks === 'object' && block.blocks !== null) {
        Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
          categorizeBlock(nestedBlock, currentPath.concat('blocks', key), inPreset);
        });
      }
    }
  }

  if (Array.isArray(rootLevelBlocks)) {
    rootLevelBlocks.forEach((block, index) => {
      categorizeBlock(block, ['blocks', String(index)]);
    });
  }

  if (presets) {
    presets.forEach((preset: Preset.Preset, presetIndex: number) => {
      if ('blocks' in preset && preset.blocks) {
        if (Array.isArray(preset.blocks)) {
          preset.blocks.forEach((block: Preset.PresetBlockForArray, blockIndex: number) => {
            categorizeBlock(
              block,
              ['presets', String(presetIndex), 'blocks', String(blockIndex)],
              true,
            );
          });
        } else if (typeof preset.blocks === 'object') {
          Object.entries(preset.blocks).forEach(([key, block]) => {
            categorizeBlock(block, ['presets', String(presetIndex), 'blocks', key], true);
          });
        }
      }
    });
  }

  return {
    staticBlockLocations,
    localBlockLocations,
    themeBlockLocations,
    hasRootLevelThemeBlocks: themeBlockLocations.some((block) => block.path[0] === 'blocks'),
  };
}

export function reportWarning(
  message: string,
  offset: number,
  astNode: LiteralNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  context.report({
    message,
    startIndex: offset + getLocStart(astNode),
    endIndex: offset + getLocEnd(astNode),
  });
}
