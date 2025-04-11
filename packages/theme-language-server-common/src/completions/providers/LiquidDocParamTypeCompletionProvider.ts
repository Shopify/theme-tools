import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { filePathSupportsLiquidDoc } from '@shopify/theme-check-common';
import { getValidParamTypes, SupportedDocTagTypes, ThemeDocset } from '@shopify/theme-check-common';

export class LiquidDocParamTypeCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];
    if (!filePathSupportsLiquidDoc(params.document.uri)) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.TextNode ||
      parentNode.type !== NodeTypes.LiquidRawTag ||
      parentNode.name !== 'doc'
    ) {
      return [];
    }

    /**
     * We need to make sure we're trying to code complete after
     * the param tag's `{` character.
     *
     * We will be removing any spaces in case there are any formatting issues.
     */
    const fragments = node.value.split(' ').filter(Boolean);
    if (
      fragments.length > 2 ||
      fragments[0] !== `@${SupportedDocTagTypes.Param}` ||
      !/^\{[a-zA-Z]*$/.test(fragments[1])
    ) {
      return [];
    }

    const liquidDrops = await this.themeDocset.liquidDrops();

    return Array.from(getValidParamTypes(liquidDrops)).map(([label, description]) => {
      const documentation = description
        ? {
            kind: MarkupKind.Markdown,
            value: description,
          }
        : undefined;

      return {
        label,
        kind: CompletionItemKind.EnumMember,
        insertText: label,
        documentation,
      };
    });
  }
}
