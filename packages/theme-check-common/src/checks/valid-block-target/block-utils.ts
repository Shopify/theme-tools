import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { Context, SourceCodeType, Schema, JSONNode } from '../../types';
import { doesFileExist } from '../../utils/file-utils';
import { visit } from '../../visitor';
import { LiteralNode, PropertyNode } from 'json-to-ast';

type BlockTypeMap = { [key: string]: Location[] };

type Location = {
  startIndex: number;
  endIndex: number;
};

type NestedBlockLocation = {
  location: Location;
  parentBlockTypes: string[];
};

type NestedPresetBlockMap = {
  [key: string]: NestedBlockLocation[];
};

type BlockValidationResult = {
  hasLocalBlocks: boolean;
  rootThemeBlockTypes: BlockTypeMap;
  presetBlockTypes: BlockTypeMap;
  nestedPresetBlockTypes: NestedPresetBlockMap;
};

function isLiteralNode(node: JSONNode): node is LiteralNode {
  return node.type === 'Literal';
}

function isPropertyNode(node: JSONNode): node is PropertyNode {
  return node.type === 'Property';
}

// Check if a node is within an array that has a specific parent key
function isInArrayWithParentKey(ancestors: JSONNode[], parentKey: string): boolean {
  return ancestors.some((ancestor, index) => {
    const parent = ancestors[index - 1];
    return (
      (ancestor.type === 'Array' || ancestor.type === 'Object') &&
      parent?.type === 'Property' &&
      parent.key?.value === parentKey
    );
  });
}

function isInBlocksArray(ancestors: JSONNode[]): boolean {
  const thirdAncestor = ancestors[ancestors.length - 3];
  const fourthAncestor = ancestors[ancestors.length - 4];

  return (
    (isPropertyNode(thirdAncestor) && thirdAncestor.key?.value === 'blocks') ||
    (isPropertyNode(fourthAncestor) && fourthAncestor.key?.value === 'blocks')
  );
}

function isInPresetsArray(ancestors: JSONNode[]): boolean {
  const sixthAncestor = ancestors[ancestors.length - 6];
  const seventhAncestor = ancestors[ancestors.length - 7];

  return (
    (isPropertyNode(sixthAncestor) && sixthAncestor.key?.value === 'presets') ||
    (isPropertyNode(seventhAncestor) && seventhAncestor.key?.value === 'presets')
  );
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

function getParentBlockTypes(ancestors: JSONNode[]): string[] {
  // TODO: Implement this
  return [];
}

export function collectAndValidateBlockTypes(jsonFile: JSONNode): BlockValidationResult {
  const rootThemeBlockTypes: BlockTypeMap = {};
  const rootLocalBlockTypes: BlockTypeMap = {};
  const presetBlockTypes: BlockTypeMap = {};
  const nestedPresetBlockTypes: NestedPresetBlockMap = {};
  visit<SourceCodeType.JSON, void>(jsonFile, {
    Property(node, ancestors) {
      // Process 'type' and 'name' properties within 'blocks'
      if (!isInArrayWithParentKey(ancestors, 'blocks') || !isLiteralNode(node.value)) return;

      const parentObject = ancestors[ancestors.length - 1];
      const hasNameProperty =
        parentObject.type === 'Object' &&
        parentObject.children.some(
          (child) => child.type === 'Property' && child.key.value === 'name',
        );

      if (node.key.value === 'type' && isInBlocksArray(ancestors)) {
        const typeValue = node.value.value;
        const typeLocation = {
          startIndex: node.value.loc!.start.offset,
          endIndex: node.value.loc!.end.offset,
        };

        // Determine the target map for block types based on their context
        type TargetMapType = BlockTypeMap | NestedPresetBlockMap | undefined;

        // Determine the target map for block types based on their context
        let targetMap: TargetMapType;
        const inPresets = isInArrayWithParentKey(ancestors, 'presets');

        if (inPresets && !isInPresetsArray(ancestors)) {
          targetMap = nestedPresetBlockTypes;
        } else if (inPresets && isInPresetsArray(ancestors)) {
          targetMap = presetBlockTypes;
        } else if (hasNameProperty) {
          targetMap = rootLocalBlockTypes;
        } else {
          targetMap = rootThemeBlockTypes;
        }

        // Add the block type to the appropriate map
        if (targetMap && typeof typeValue === 'string') {
          if (targetMap === nestedPresetBlockTypes) {
            const parentTypes = getParentBlockTypes(ancestors);
            targetMap[typeValue] = targetMap[typeValue] || [];
            targetMap[typeValue].push({
              location: typeLocation,
              parentBlockTypes: parentTypes,
            });
          } else {
            (targetMap as BlockTypeMap)[typeValue] = (targetMap as BlockTypeMap)[typeValue] || [];
            (targetMap as BlockTypeMap)[typeValue].push(typeLocation);
          }
        }
      }
    },
  });

  return {
    hasLocalBlocks: Object.keys(rootLocalBlockTypes).length > 0,
    rootThemeBlockTypes,
    presetBlockTypes,
    nestedPresetBlockTypes,
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
