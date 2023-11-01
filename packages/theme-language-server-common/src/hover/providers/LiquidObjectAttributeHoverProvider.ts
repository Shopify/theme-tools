import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { TypeSystem, isArrayType } from '../../TypeSystem';
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

    const parentType = await this.typeSystem.inferType(node, ancestors[0], params.textDocument.uri);
    if (isArrayType(parentType)) {
      return null;
    }

    const objectMap = await this.typeSystem.objectMap(params.textDocument.uri, ancestors[0]);
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
