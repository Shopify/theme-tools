import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { Context, SourceCodeType, Schema, JSONNode } from '../../types';
import { visit } from '../../visitor';
import { LiteralNode } from 'json-to-ast';

type BlockTypeMap = { [key: string]: Location[] };

type Location = {
  startIndex: number;
  endIndex: number;
};

function isLiteralNode(node: JSONNode): node is LiteralNode {
  return node.type === 'Literal';
}

export function collectBlockProperties(jsonFile: JSONNode): {
  hasLocalBlocks: boolean;
  hasStaticBlocks: boolean;
  hasThemeBlocks: boolean;
  acceptsTheme: boolean;
  localBlockLocations: Location[];
  themeBlockLocations: Location[];
  staticBlockLocations: BlockTypeMap;
  staticBlockNameLocations: Location[];
} {
  const localBlockLocations: Location[] = [];
  const themeBlockLocations: Location[] = [];
  const staticBlockLocations: BlockTypeMap = {};
  const staticBlockNameLocations: Location[] = [];
  let acceptsTheme = false;

  visit<SourceCodeType.JSON, void>(jsonFile, {
    Property(node, ancestors) {
      if (!isInArrayWithParentKey(ancestors, 'blocks') || !isLiteralNode(node.value)) return;

      const parentObject = ancestors[ancestors.length - 1];
      const isStatic =
        parentObject.type === 'Object' &&
        parentObject.children.some(
          (child) =>
            child.type === 'Property' &&
            child.key.value === 'static' &&
            isLiteralNode(child.value) &&
            child.value.value === true,
        );

      if (node.key.value === 'type') {
        const typeValue = node.value.value;
        const typeLocation = {
          startIndex: node.value.loc!.start.offset,
          endIndex: node.value.loc!.end.offset,
        };

        if (typeValue === '@theme' && !isInArrayWithParentKey(ancestors, 'presets')) {
          acceptsTheme = true;
        }

        const hasName =
          parentObject.type === 'Object' &&
          parentObject.children.some(
            (child) => child.type === 'Property' && child.key.value === 'name',
          );

        if (isStatic && !hasName && typeof typeValue === 'string') {
          staticBlockLocations[typeValue] = staticBlockLocations[typeValue] || [];
          staticBlockLocations[typeValue].push(typeLocation);
        } else if (!hasName && typeValue !== '@theme' && typeValue !== '@app') {
          themeBlockLocations.push(typeLocation);
        }
      } else if (node.key.value === 'name') {
        const nameLocation = {
          startIndex: node.value.loc!.start.offset,
          endIndex: node.value.loc!.end.offset,
        };
        if (isStatic) {
          staticBlockNameLocations.push(nameLocation);
        } else {
          localBlockLocations.push(nameLocation);
        }
      }
    },
  });

  return {
    hasLocalBlocks: localBlockLocations.length > 0,
    hasStaticBlocks: Object.keys(staticBlockLocations).length > 0,
    hasThemeBlocks: themeBlockLocations.length > 0,
    acceptsTheme,
    localBlockLocations,
    staticBlockLocations,
    themeBlockLocations,
    staticBlockNameLocations,
  };
}

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
