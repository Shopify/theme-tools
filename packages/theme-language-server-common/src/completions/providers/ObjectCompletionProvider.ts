import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { TypeSystem } from '../../TypeSystem';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem } from './common';

export class ObjectCompletionProvider implements Provider {
  constructor(private readonly typeSystem: TypeSystem) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { partialAst, node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (!node || node.type !== NodeTypes.VariableLookup) {
      return [];
    }

    if (!node.name || node.lookups.length > 0) {
      // We only do top level in this one.
      return [];
    }

    // ContentFor and Render uses VariableLookup to support completion of NamedParams.
    if (
      parentNode?.type === NodeTypes.ContentForMarkup ||
      parentNode?.type === NodeTypes.RenderMarkup
    ) {
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const options = await this.typeSystem.availableVariables(
      partialAst,
      partial,
      node,
      params.textDocument.uri,
    );
    return options.map(({ entry, type }) =>
      createCompletionItem(entry, { kind: CompletionItemKind.Variable }, 'object', type),
    );
  }
}
