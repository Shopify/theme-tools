import { Hover, HoverParams } from 'vscode-languageserver';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { NodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { TypeSystem, isArrayType } from '../../TypeSystem';
import { render } from '../../docset';

export class LiquidObjectAttributeHoverProvider implements BaseHoverProvider {
  constructor(private typeSystem: TypeSystem) {}

  async hover(
    _params: HoverParams,
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
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

    const parentType = await this.typeSystem.inferType(node, ancestors[0]);
    if (isArrayType(parentType)) {
      return null;
    }

    const objectMap = await this.typeSystem.objectMap();
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
