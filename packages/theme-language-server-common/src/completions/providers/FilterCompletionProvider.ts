import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { LiquidHtmlNodeTypes as NodeTypes, ThemeDocset } from '@shopify/theme-check-common';
import { Provider, createCompletionItem, sortByName } from './common';
import { CURSOR, LiquidCompletionParams } from '../params';

export class FilterCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { partialAst, node, ancestors } = params.completionContext;
    if (!node || node.type !== NodeTypes.LiquidFilter) {
      return [];
    }

    if (node.args.length > 0) {
      // We only do name completion
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const globals = await this.themeDocset.filters();
    return [];

    // const context = collectVariables(partialAst, ancestors);
    // const options = globals.concat(context);
    // return options
    //   .filter(({ name }) => name.startsWith(partial))
    //   .sort(sortByName)
    //   .map((tag) => createCompletionItem(tag, { kind: CompletionItemKind.Variable }));
  }
}
