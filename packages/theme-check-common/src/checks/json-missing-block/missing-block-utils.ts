import { Context, SourceCodeType, JSONNode } from '../../types';
import { PropertyNode } from '../../jsonc/types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { doesFileExist } from '../../utils/file-utils';
import { Section } from '../../types/schemas';

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

async function getAllowedBlocks(
  sectionType: string,
  currentPath: string[],
  context: Context<SourceCodeType.JSON>,
): Promise<Section.Block[] | undefined> {
  if (typeof sectionType !== 'string' || !sectionType) return;

  const schema = isNestedBlock(currentPath)
    ? await context.getBlockSchema?.(sectionType)
    : await context.getSectionSchema?.(sectionType);
  if (!schema || schema instanceof Error) return;

  const { validSchema } = schema;
  // Missing or invalid host schemas are handled by other checks. Do not infer
  // app or theme block permissions from an unavailable or unvalidated schema.
  if (!validSchema || validSchema instanceof Error) return;

  return Array.isArray(validSchema.blocks) ? validSchema.blocks : [];
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
  const allowedBlocks = await getAllowedBlocks(ancestorType, currentPath, context);
  if (!allowedBlocks) return;

  const location = isNestedBlock(currentPath) ? 'blocks' : 'sections';

  // App blocks are remote references and require permission from their immediate host.
  if (blockType.startsWith('shopify://apps/')) {
    if (!allowedBlocks.some((block) => !('name' in block) && block.type === '@app')) {
      reportWarning(
        `Block type '${blockType}' is not allowed in '${location}/${ancestorType}.liquid'.`,
        offset,
        blockPath,
        context,
      );
    }
    return;
  }

  // Section blocks do not need a file in blocks/.
  if (allowedBlocks.some((block) => 'name' in block && block.type === blockType)) return;
  const themeBlocks = allowedBlocks
    .filter((block) => !('name' in block) && block.type !== '@app')
    .map((block) => block.type);
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
      if (typeof block.type === 'string' && block.type) {
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
