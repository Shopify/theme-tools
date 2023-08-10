import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { FilterEntry, LiquidHtmlNodeTypes as NodeTypes } from '@shopify/theme-check-common';
import { Provider, createCompletionItem, sortByName } from './common';
import { CURSOR, LiquidCompletionParams } from '../params';
import { isArrayType, PseudoType, TypeSystem } from '../TypeSystem';
import { memoize } from '../../utils';

export class FilterCompletionProvider implements Provider {
  constructor(private readonly typeSystem: TypeSystem) {}

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

    // We'll fake a LiquidVariable
    let parentVariable = ancestors.at(-1);
    if (
      !parentVariable ||
      parentVariable.type !== NodeTypes.LiquidVariable ||
      parentVariable.filters.at(-1) !== node
    ) {
      return []; // something went wrong...
    }

    // We'll infer the type of the variable up to the last filter (excluding this one)
    parentVariable = { ...parentVariable }; // soft clone
    parentVariable.filters = parentVariable.filters.slice(0, -1); // remove last one
    const inputType = await this.typeSystem.inferType(parentVariable, partialAst);
    const partial = node.name.replace(CURSOR, '');
    const options = await this.options(isArrayType(inputType) ? 'array' : inputType);
    return completionItems(options, partial);
  }

  options: (inputType: PseudoType) => Promise<FilterEntry[]> = memoize(
    async (inputType) => {
      const filterEntries = await this.typeSystem.filterEntries();

      const options = filterEntries
        .filter((entry) => entry.syntax?.startsWith(inputType))
        .sort(sortByName);

      if (inputType === 'variable') {
        return options;
      }

      if (options.length === 0) {
        return filterEntries.sort(sortByName);
      }

      const untypedOptions = await this.options('variable');

      return [...options, ...untypedOptions];
    },
    (inputType) => inputType,
  );
}

function completionItems(options: FilterEntry[], partial: string) {
  return options.filter(({ name }) => name.startsWith(partial)).map(toPropertyCompletionItem);
}

function toPropertyCompletionItem(entry: FilterEntry) {
  return createCompletionItem(entry, { kind: CompletionItemKind.Function });
}
