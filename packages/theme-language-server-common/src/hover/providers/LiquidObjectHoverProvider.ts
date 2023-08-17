import { Hover, HoverParams } from 'vscode-languageserver';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { NodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';
import { render } from '../../completions/providers/common';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { TypeSystem, isArrayType } from '../../TypeSystem';

export class LiquidObjectHoverProvider implements BaseHoverProvider {
  constructor(private typeSystem: TypeSystem) {}

  async hover(
    _params: HoverParams,
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<Hover | null> {
    if (
      currentNode.type !== NodeTypes.VariableLookup &&
      currentNode.type !== NodeTypes.AssignMarkup
    ) {
      return null;
    }

    if (!currentNode.name) {
      return null;
    }

    const type = await this.typeSystem.inferType(currentNode, ancestors[0]);
    const objectMap = await this.typeSystem.objectMap();
    const entry = objectMap[isArrayType(type) ? type.valueType : type];

    if (!entry) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: render(entry, isArrayType(type)),
      },
    };
  }
}
