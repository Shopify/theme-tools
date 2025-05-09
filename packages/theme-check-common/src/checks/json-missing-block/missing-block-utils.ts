import { Context, SourceCodeType, JSONNode } from '../../types';
import { PropertyNode } from '../../jsonc/types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { doesFileExist } from '../../utils/file-utils';

export function isPropertyNode(node: unknown): node is PropertyNode {
  return typeof node === 'object' && node !== null;
}

function isNestedBlock(currentPath: string[]): boolean {
  return currentPath.filter((segment) => segment === 'blocks').length > 1;
}

function reportWarning(
  message: string,
  offset: number,
  astNode: JSONNode,
  context: Context<SourceCodeType.JSON>,
) {
  context.report({
    message,
    startIndex: offset + getLocStart(astNode),
    endIndex: offset + getLocEnd(astNode),
  });
}

async function validateBlockFileExistence(
  blockType: string,
  context: Context<SourceCodeType.JSON>,
): Promise<boolean> {
  if (blockType === '@theme' || blockType === '@app') {
    return true;
  }
  const blockPath = `blocks/${blockType}.liquid`;
  return await doesFileExist(context, blockPath);
}

async function getThemeBlocks(
  sectionType: string,
  currentPath: string[],
  context: Context<SourceCodeType.JSON>,
): Promise<string[]> {
  const themeBlocks: string[] = [];
  if (!sectionType) return themeBlocks;

  const schema = isNestedBlock(currentPath)
    ? await context.getBlockSchema?.(sectionType)
    : await context.getSectionSchema?.(sectionType);
  if (!schema || schema instanceof Error) return themeBlocks;

  const { validSchema } = schema;
  if (!validSchema || validSchema instanceof Error) return themeBlocks;

  if (Array.isArray(validSchema.blocks)) {
    validSchema.blocks.forEach((block) => {
      if (!('name' in block) && block.type !== '@app') {
        themeBlocks.push(block.type);
      }
    });
  }
  return themeBlocks;
}

async function validateBlock(
  blockType: string,
  blockStatic: boolean,
  blockPath: JSONNode,
  ancestorType: string,
  currentPath: string[],
  offset: number,
  context: Context<SourceCodeType.JSON>,
) {
  const themeBlocks = await getThemeBlocks(ancestorType, currentPath, context);
  if (themeBlocks.length === 0) return;

  const exists = await validateBlockFileExistence(blockType, context);
  if (!exists) {
    reportWarning(
      `Theme block 'blocks/${blockType}.liquid' does not exist.`,
      offset,
      blockPath,
      context,
    );
  } else if (blockStatic) {
    // Static blocks are not required to be in the schema blocks array
    return;
  } else {
    const isPrivateBlock = blockType.startsWith('_');
    const schemaIncludesAtTheme = themeBlocks.includes('@theme');
    const schemaIncludesBlockType = themeBlocks.includes(blockType);

    if (
      !isPrivateBlock ? schemaIncludesBlockType || schemaIncludesAtTheme : schemaIncludesBlockType
    ) {
      return;
    } else {
      const location = isNestedBlock(currentPath) ? 'blocks' : 'sections';
      reportWarning(
        `Block type '${blockType}' is not allowed in '${location}/${ancestorType}.liquid'.`,
        offset,
        blockPath,
        context,
      );
    }
  }
}

export async function getAllBlocks(
  ast: JSONNode,
  offset: number,
  ancestorType: string,
  blocks: PropertyNode,
  currentPath: string[],
  context: Context<SourceCodeType.JSON>,
): Promise<void> {
  await Promise.all(
    Object.entries(blocks).map(async ([blockKey, block]) => {
      if (block.type) {
        const typePath = currentPath.concat(blockKey, 'type');
        const blockPath = nodeAtPath(ast, typePath)! as JSONNode;

        if (blockPath) {
          await validateBlock(
            block.type,
            block.static,
            blockPath,
            ancestorType,
            currentPath,
            offset,
            context,
          );
        }
      }

      if ('blocks' in block) {
        await getAllBlocks(
          ast,
          offset,
          block.type,
          block.blocks,
          currentPath.concat(blockKey, 'blocks'),
          context,
        );
      }
    }),
  );
}
