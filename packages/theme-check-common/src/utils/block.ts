import {
  JSONNode,
  LiteralNode,
  Preset,
  Section,
  SourceCodeType,
  ThemeBlock,
  Context,
} from '../types';
import { getLocEnd, getLocStart, nodeAtPath } from '../json';
import { doesFileExist } from './file-utils';

export type BlockNodeWithPath = {
  node: Section.Block | ThemeBlock.Block | Preset.Block;
  path: string[];
};

export function getBlocks(validSchema: ThemeBlock.Schema | Section.Schema): {
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
  function categorizeRootLevelBlocks(block: Preset.Block, index: number) {
    if (!block) return;
    const hasName = 'name' in block;

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

  function categorizePresetLevelBlocks(
    block: Preset.Block,
    currentPath: string[],
    depth: number = 0,
  ) {
    if (!block) return;

    if (!presetLevelBlocks[depth]) {
      presetLevelBlocks[depth] = [];
    }

    presetLevelBlocks[depth].push({
      node: block,
      path: currentPath.concat('type'),
    });

    if ('blocks' in block) {
      if (Array.isArray(block.blocks)) {
        block.blocks.forEach((nestedBlock: Preset.PresetBlockForArray, index: number) => {
          categorizePresetLevelBlocks(
            nestedBlock,
            currentPath.concat('blocks', String(index)),
            depth + 1,
          );
        });
      } else if (typeof block.blocks === 'object' && block.blocks !== null) {
        Object.entries(block.blocks).forEach(([key, nestedBlock]) => {
          categorizePresetLevelBlocks(nestedBlock, currentPath.concat('blocks', key), depth + 1);
        });
      }
    }
  }

  if (Array.isArray(rootLevelBlocks)) {
    rootLevelBlocks.forEach((block, index) => {
      categorizeRootLevelBlocks(block, index);
    });
  }

  if (presets) {
    presets.forEach((preset: Preset.Preset, presetIndex: number) => {
      if ('blocks' in preset && preset.blocks) {
        if (Array.isArray(preset.blocks)) {
          preset.blocks.forEach((block, blockIndex) => {
            categorizePresetLevelBlocks(
              block,
              ['presets', String(presetIndex), 'blocks', String(blockIndex)],
              0,
            );
          });
        } else if (typeof preset.blocks === 'object') {
          Object.entries(preset.blocks).forEach(([key, block]) => {
            categorizePresetLevelBlocks(block, ['presets', String(presetIndex), 'blocks', key], 0);
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

export function isInvalidPresetBlock(
  blockNode: Section.Block | ThemeBlock.Block | Preset.Block,
  rootLevelThemeBlocks: BlockNodeWithPath[],
): boolean {
  const isPrivateBlockType = blockNode.type.startsWith('_');
  const isThemeInRootLevel = rootLevelThemeBlocks.some((block) => block.node.type === '@theme');
  const needsExplicitRootBlock = isPrivateBlockType || !isThemeInRootLevel;
  const isPresetInRootLevel = rootLevelThemeBlocks.some(
    (block) => block.node.type === blockNode.type,
  );

  return !isPresetInRootLevel && needsExplicitRootBlock;
}

function validateBlockTargeting(
  nestedBlock: Preset.PresetBlockForArray | Preset.PresetBlockForHash,
  nestedPath: string[],
  context: Context<SourceCodeType.LiquidHtml>,
  parentNode: Preset.PresetBlockForArray | Preset.PresetBlockForHash,
  rootLevelThemeBlocks: BlockNodeWithPath[],
  allowedBlockTypes: string[],
  offset: number,
  ast: JSONNode,
) {
  const typeNode = nodeAtPath(ast, nestedPath)! as LiteralNode;

  if (typeNode && isInvalidPresetBlock(nestedBlock, rootLevelThemeBlocks)) {
    const isPrivateBlock = nestedBlock.type.startsWith('_');
    const errorMessage = isPrivateBlock
      ? `Private block type "${nestedBlock.type}" is not allowed in "${parentNode.type}" blocks.`
      : `Block type "${nestedBlock.type}" is not allowed in "${
          parentNode.type
        }" blocks. Allowed types are: ${allowedBlockTypes.join(', ')}.`;
    reportOnJsonNode(errorMessage, offset, typeNode, context);
  }

  if ('blocks' in nestedBlock && nestedBlock.blocks) {
    validateNestedBlocks(
      context,
      nestedBlock,
      nestedBlock.blocks,
      nestedPath.slice(0, -1),
      offset,
      ast,
    );
  }
}

export async function validateNestedBlocks(
  context: Context<SourceCodeType.LiquidHtml>,
  parentNode: Preset.PresetBlockForHash | Preset.PresetBlockForArray,
  nestedBlocks: Preset.PresetBlockHash | Preset.PresetBlockForArray[],
  currentPath: string[],
  offset: number,
  ast: JSONNode,
) {
  if (!nestedBlocks) return;

  const parentSchema = await context.getBlockSchema?.(parentNode.type);
  if (!parentSchema || parentSchema instanceof Error) return;

  const { validSchema } = parentSchema;
  if (!validSchema || validSchema instanceof Error) return;

  const { rootLevelThemeBlocks } = getBlocks(validSchema);
  const allowedBlockTypes = rootLevelThemeBlocks.map((block) => block.node.type);

  if (Array.isArray(nestedBlocks)) {
    nestedBlocks.forEach((nestedBlock, index) => {
      const nestedPath = currentPath.concat(['blocks', String(index), 'type']);
      validateBlockTargeting(
        nestedBlock,
        nestedPath,
        context,
        parentNode,
        rootLevelThemeBlocks,
        allowedBlockTypes,
        offset,
        ast,
      );
    });
  } else if (typeof nestedBlocks === 'object') {
    Object.entries(nestedBlocks).forEach(([key, nestedBlock]) => {
      const nestedPath = currentPath.concat(['blocks', key, 'type']);
      validateBlockTargeting(
        nestedBlock,
        nestedPath,
        context,
        parentNode,
        rootLevelThemeBlocks,
        allowedBlockTypes,
        offset,
        ast,
      );
    });
  }
}

export function reportOnJsonNode(
  message: string,
  offset: number,
  astNode: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  context.report({
    message,
    startIndex: offset + getLocStart(astNode),
    endIndex: offset + getLocEnd(astNode),
  });
}

export async function validateBlockFileExistence(
  blockType: string,
  context: Context<SourceCodeType.LiquidHtml>,
): Promise<boolean> {
  if (blockType === '@theme' || blockType === '@app') {
    return true;
  }

  const blockPath = `blocks/${blockType}.liquid`;
  return await doesFileExist(context, blockPath);
}
