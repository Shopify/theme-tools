import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { Context, SourceCodeType, Schema, JSONNode } from '../../types';
import { visit } from '../../visitor';
import { LiteralNode } from 'json-to-ast';

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
  localBlockLocations: Location[];
  themeBlockLocations: Location[];
  staticBlockLocations: Location[];
  staticBlockNameLocations: Location[];
} {
  const localBlockLocations: Location[] = [];
  const themeBlockLocations: Location[] = [];
  const staticBlockLocations: Location[] = [];
  const staticBlockNameLocations: Location[] = [];

  visit<SourceCodeType.JSON, void>(jsonFile, {
    Property(node, ancestors) {
      if (!isInArrayWithParentKey(ancestors, 'blocks') || !isLiteralNode(node.value)) return;

      const parentObject = ancestors[ancestors.length - 1];
      const isStatic =
        parentObject.type === 'Object' &&
        parentObject.children.some(
          (child) => child.type === 'Property' && child.key.value === 'static',
        );

      if (node.key.value === 'type') {
        const typeValue = node.value.value;
        const typeLocation = {
          startIndex: node.value.loc!.start.offset,
          endIndex: node.value.loc!.end.offset,
        };

        const hasName =
          parentObject.type === 'Object' &&
          parentObject.children.some(
            (child) => child.type === 'Property' && child.key.value === 'name',
          );

        if (isStatic && !hasName && typeof typeValue === 'string') {
          staticBlockLocations.push(typeLocation);
        } else if (
          !hasName &&
          typeValue !== '@app' &&
          !isInArrayWithParentKey(ancestors, 'presets')
        ) {
          themeBlockLocations.push(typeLocation);
        }
      } else if (node.key.value === 'name') {
        const nameKeyLocation = {
          startIndex: node.key.loc!.start.offset,
          endIndex: node.key.loc!.end.offset,
        };
        if (isStatic) {
          staticBlockNameLocations.push(nameKeyLocation);
        } else {
          localBlockLocations.push(nameKeyLocation);
        }
      }
    },
  });

  return {
    hasLocalBlocks: localBlockLocations.length > 0,
    hasStaticBlocks: staticBlockLocations.length > 0,
    hasThemeBlocks: themeBlockLocations.length > 0,
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
      (ancestor.type === 'Array' || ancestor.type === 'Object') &&
      parent?.type === 'Property' &&
      parent.key?.value === parentKey
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
