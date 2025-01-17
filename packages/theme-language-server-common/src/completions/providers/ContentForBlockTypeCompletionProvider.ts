import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

export class ContentForBlockTypeCompletionProvider implements Provider {
  constructor(
    private readonly getThemeBlockNames: (
      rootUri: string,
      includePrivate: boolean,
    ) => Promise<string[]>,
  ) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { document } = params;
    const doc = document.textDocument;
    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);
    const grandParentNode = ancestors.at(-2);

    if (
      !node ||
      !parentNode ||
      !grandParentNode ||
      node.type !== NodeTypes.String ||
      parentNode.type !== NodeTypes.NamedArgument ||
      parentNode.name !== 'type' ||
      grandParentNode.type !== NodeTypes.ContentForMarkup ||
      grandParentNode.contentForType.value !== 'block'
    ) {
      return [];
    }

    return (await this.getThemeBlockNames(doc.uri, false)).map((blockName) => ({
      label: blockName,
      kind: CompletionItemKind.EnumMember,
      insertText: blockName,
    }));
  }
}
