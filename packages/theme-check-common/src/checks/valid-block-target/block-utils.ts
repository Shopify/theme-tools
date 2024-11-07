import { Context, SourceCodeType, Schema } from '../../types';
import { doesFileExist } from '../../utils/file-utils';
import { ASTNode } from 'vscode-json-languageservice';

type Location = [number, number]; // [offset, length]

export function hasLocalBlocks(root: ASTNode): { found: boolean; locations: Location[] } {
  const locations: Location[] = [];
  if (root.type !== 'object' || !root.properties) return { found: false, locations };

  const blocksProperty = root.properties.find((p) => p.keyNode?.value === 'blocks');
  if (!blocksProperty || blocksProperty.valueNode?.type !== 'array')
    return { found: false, locations };

  for (const block of blocksProperty.valueNode.items || []) {
    if (block.type !== 'object' || !block.properties) continue;

    const typeProperty = block.properties.find((p) => p.keyNode?.value === 'type');
    const nameProperty = block.properties.find((p) => p.keyNode?.value === 'name');

    if (typeProperty && nameProperty?.valueNode) {
      locations.push([nameProperty.valueNode.offset, nameProperty.valueNode.length]);
    }
  }

  return { found: locations.length > 0, locations };
}

export function collectBlockTypes(block: ASTNode, typeMap: { [key: string]: Location[] }) {
  if (!block || block.type !== 'object' || !block.properties) return;

  const typeProperty = block.properties.find((p) => p.keyNode?.value === 'type');
  if (typeProperty?.valueNode?.value && typeof typeProperty.valueNode.value === 'string') {
    const blockType = typeProperty.valueNode.value;
    const existingLocations = typeMap[blockType] || [];
    typeMap[blockType] = [
      ...existingLocations,
      [typeProperty.valueNode.offset, typeProperty.valueNode.length],
    ];
  }

  // Handle nested blocks
  const blocksProperty = block.properties.find((p) => p.keyNode?.value === 'blocks');
  if (blocksProperty?.valueNode?.type === 'array') {
    for (const nestedBlock of blocksProperty.valueNode.items || []) {
      collectBlockTypes(nestedBlock, typeMap);
    }
  }
}

export async function validateBlockFileExistence(
  blockType: string,
  context: Context<SourceCodeType.LiquidHtml, Schema>,
): Promise<boolean> {
  if (blockType === '@theme' || blockType === '@app') {
    return true;
  }

  const blockPath = `blocks/${blockType}.liquid`;
  const exists = await doesFileExist(context, blockPath);
  return exists;
}
