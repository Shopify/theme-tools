import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { TypeSystem, Unknown, Untyped, isArrayType } from '../../TypeSystem';
import { render } from '../../docset';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidObjectAttributeHoverProvider implements BaseHoverProvider {
  constructor(private typeSystem: TypeSystem) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
    const uri = params.textDocument.uri;
    if (
      currentNode.type !== NodeTypes.String ||
      !parentNode ||
      parentNode.type !== NodeTypes.VariableLookup ||
      !parentNode.lookups.includes(currentNode)
    ) {
      return null;
    }

    const lookupIndex = parentNode.lookups.findIndex((lookup) => lookup === currentNode);
    const node = {
      ...parentNode,
      lookups: parentNode.lookups.slice(0, lookupIndex),
    };

    const objectMap = await this.typeSystem.objectMap(uri, ancestors[0]);
    const parentType = await this.typeSystem.inferType(node, ancestors[0], uri);

    if (isArrayType(parentType) || parentType === 'string' || parentType === Untyped) {
      const nodeType = await this.typeSystem.inferType(
        { ...parentNode, lookups: parentNode.lookups.slice(0, lookupIndex + 1) },
        ancestors[0],
        uri,
      );

      // 2D arrays and unknown types are not supported
      if (isArrayType(nodeType) || nodeType === Unknown) return null;

      // We want want `## first: `nodeType` with the docs of the nodeType
      const entry = { ...(objectMap[nodeType] ?? {}), name: currentNode.value };

      return {
        contents: {
          kind: 'markdown',
          value: render(entry, nodeType),
        },
      };
    }

    const parentEntry = objectMap[parentType];
    if (!parentEntry) {
      return null;
    }

    const parentTypeProperties = objectMap[parentType]?.properties || [];
    const entry = parentTypeProperties.find((p) => p.name === currentNode.value);
    if (!entry) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: render(entry),
      },
    };
  }
}
