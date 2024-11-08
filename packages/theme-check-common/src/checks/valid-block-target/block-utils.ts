import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { Context, SourceCodeType, Schema, JSONNode } from '../../types';
import { doesFileExist } from '../../utils/file-utils';
import { visit } from '../../visitor';
import { LiteralNode } from 'json-to-ast';

type BlockTypeMap = { [key: string]: Location[] };

type Location = {
  startIndex: number;
  endIndex: number;
};

type BlockValidationResult = {
  rootBlockTypes: BlockTypeMap;
  presetBlockTypes: BlockTypeMap;
  hasLocalBlocks: boolean;
  hasThemeBlocks: boolean;
  localBlockLocations: Location[];
  themeBlockLocations: Location[];
};

function isLiteralNode(node: JSONNode): node is LiteralNode {
  return node.type === 'Literal';
}

// Function to determine if a node is in an array with a specific parent key
function isInArrayWithParentKey(ancestors: JSONNode[], parentKey: string): boolean {
  return ancestors.some((ancestor, index) => {
    const parent = ancestors[index - 1];
    return (
      ancestor.type === 'Array' && parent?.type === 'Property' && parent.key?.value === parentKey
    );
  });
}

export const reportError =
  (message: string, context: Context<SourceCodeType.LiquidHtml, Schema>, node: LiquidRawTag) =>
  (location: Location) => {
    context.report({
      message,
      startIndex: node.blockStartPosition.end + location.startIndex,
      endIndex: node.blockStartPosition.end + location.endIndex,
    });
  };

export function collectAndValidateBlockTypes(jsonFile: JSONNode): BlockValidationResult {
  const rootBlockTypes: BlockTypeMap = {};
  const presetBlockTypes: BlockTypeMap = {};
  const localBlockLocations: Location[] = [];
  const themeBlockLocations: Location[] = [];

  visit<SourceCodeType.JSON, void>(jsonFile, {
    Property(node, ancestors) {
      // Only process type and name properties within blocks
      if (!isInArrayWithParentKey(ancestors, 'blocks') || !isLiteralNode(node.value)) return;

      if (node.key.value === 'type') {
        const typeValue = node.value.value;
        const typeLocation = {
          startIndex: node.value.loc!.start.offset,
          endIndex: node.value.loc!.end.offset,
        };

        // Add to appropriate map
        const inPresets = isInArrayWithParentKey(ancestors, 'presets');
        const targetMap = inPresets ? presetBlockTypes : rootBlockTypes;
        if (typeof typeValue === 'string') {
          targetMap[typeValue] = targetMap[typeValue] || [];
          targetMap[typeValue].push(typeLocation);
        }

        // Check if this block has a name property (local block)
        const parentObject = ancestors[ancestors.length - 1];
        const hasName =
          parentObject.type === 'Object' &&
          parentObject.children.some(
            (child) => child.type === 'Property' && child.key.value === 'name',
          );

        if (!hasName && typeValue !== '@theme' && typeValue !== '@app') {
          themeBlockLocations.push(typeLocation);
        }
      } else if (node.key.value === 'name') {
        localBlockLocations.push({
          startIndex: node.value.loc!.start.offset,
          endIndex: node.value.loc!.end.offset,
        });
      }
    },
  });

  return {
    rootBlockTypes,
    presetBlockTypes,
    hasLocalBlocks: localBlockLocations.length > 0,
    hasThemeBlocks: themeBlockLocations.length > 0,
    localBlockLocations,
    themeBlockLocations,
  };
}

export async function validateBlockFileExistence(
  blockType: string,
  context: Context<SourceCodeType.LiquidHtml, Schema>,
): Promise<boolean> {
  if (blockType === '@theme' || blockType === '@app') {
    return true;
  }

  const blockPath = `blocks/${blockType}.liquid`;
  return await doesFileExist(context, blockPath);
}
