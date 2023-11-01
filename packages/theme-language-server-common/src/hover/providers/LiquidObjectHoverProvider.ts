import { LiquidHtmlNode, LiquidVariableLookup, NodeTypes } from '@shopify/liquid-html-parser';
import { Hover, HoverParams } from 'vscode-languageserver';
import { TypeSystem, isArrayType } from '../../TypeSystem';
import { render } from '../../docset';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidObjectHoverProvider implements BaseHoverProvider {
  constructor(private typeSystem: TypeSystem) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
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

    let node = currentNode;
    if (node.type === NodeTypes.VariableLookup) {
      node = {
        ...currentNode,
        lookups: [],
      } as LiquidVariableLookup;
    }

    const type = await this.typeSystem.inferType(node, ancestors[0], params.textDocument.uri);
    const objectMap = await this.typeSystem.objectMap(params.textDocument.uri, ancestors[0]);
    const entry = objectMap[isArrayType(type) ? type.valueType : type];

    if (type === 'untyped') {
      return null;
    }

    if (!entry) {
      const entryByName = objectMap[currentNode.name] ?? {};
      return {
        contents: {
          kind: 'markdown',
          value: render(
            {
              ...entryByName,
              name: currentNode.name,
            },
            type,
            'object',
          ),
        },
      };
    }

    return {
      contents: {
        kind: 'markdown',
        value: render({ ...entry, name: currentNode.name }, type, 'object'),
      },
    };
  }
}
