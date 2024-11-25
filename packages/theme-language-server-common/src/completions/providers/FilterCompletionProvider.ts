import { NodeTypes } from '@shopify/liquid-html-parser';
import { FilterEntry, Parameter } from '@shopify/theme-check-common';
import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import { PseudoType, TypeSystem, isArrayType } from '../../TypeSystem';
import { memoize } from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem, sortByName } from './common';

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
    const inputType = await this.typeSystem.inferType(
      parentVariable,
      partialAst,
      params.textDocument.uri,
    );
    const partial = node.name.replace(CURSOR, '');
    const options = await this.options(isArrayType(inputType) ? 'array' : inputType);
    return completionItems(options, partial);
  }

  options: (inputType: PseudoType) => Promise<MaybeDeprioritisedFilterEntry[]> = memoize(
    async (inputType) => {
      const filterEntries = await this.typeSystem.filterEntries();

      const options = filterEntries
        .filter((entry) => entry.syntax?.startsWith(inputType))
        .sort(sortByName);

      // Case we take "anything" as argument
      if (inputType === 'variable') {
        const entriesWithoutSyntax = filterEntries.filter((entry) => !entry.syntax);
        return options.concat(entriesWithoutSyntax).sort(sortByName);
      }

      // Case there doesn't exist filter entries for that type
      if (options.length === 0) {
        return filterEntries.sort(sortByName);
      }

      const untypedOptions = await this.options('variable');

      // We show 'array' options before 'untyped' options because they feel
      // like better options.
      return [...options, ...untypedOptions.map(deprioritized)];
    },
    (inputType) => inputType,
  );
}

type MaybeDeprioritisedFilterEntry = FilterEntry & { deprioritized?: boolean };

function deprioritized(entry: FilterEntry): MaybeDeprioritisedFilterEntry {
  return { ...entry, deprioritized: true };
}

function completionItems(options: MaybeDeprioritisedFilterEntry[], partial: string) {
  return options.filter(({ name }) => name.startsWith(partial)).map(toPropertyCompletionItem);
}

function toPropertyCompletionItem(entry: MaybeDeprioritisedFilterEntry) {
  const { insertText, insertStyle } = appendRequiredParemeters(entry);

  return createCompletionItem(
    entry,
    {
      kind: CompletionItemKind.Function,
      insertText,
      insertTextFormat: insertStyle,
    },
    'filter',
  );
}

function appendRequiredParemeters(entry: MaybeDeprioritisedFilterEntry): {
  insertText: string;
  insertStyle: InsertTextFormat;
} {
  let insertText = entry.name;
  let insertStyle: InsertTextFormat = InsertTextFormat.PlainText;

  if (!entry?.parameters?.length) {
    return { insertText, insertStyle };
  }

  const requiredPositionalParams = entry.parameters
    .filter((p) => p.required && p.positional)
    .map(formatParameter);
  const requiredNamedParams = entry.parameters
    .filter((p) => p.required && !p.positional)
    .map(formatParameter);

  if (requiredPositionalParams.length) {
    insertText += `: ${requiredPositionalParams.join(', ')}`;
    insertStyle = InsertTextFormat.Snippet;
  }

  if (requiredNamedParams.length) {
    insertText += `: ${requiredNamedParams.join(', ')}`;
    insertStyle = InsertTextFormat.Snippet;
  }

  return {
    insertText,
    insertStyle,
  };
}

function formatParameter(parameter: Parameter, index: number) {
  let cursorLocation = '';

  if (parameter.positional) {
    cursorLocation = `$\{${index + 1}:${parameter.name}\}`;
  } else {
    cursorLocation = `$${index + 1}`;
  }

  if (parameter.types[0] === 'string') {
    cursorLocation = `'${cursorLocation}'`;
  }

  return parameter.positional ? cursorLocation : `${parameter.name}: ${cursorLocation}`;
}
