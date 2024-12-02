import { LiquidFilter, NodeTypes } from '@shopify/liquid-html-parser';
import { FilterEntry, Parameter } from '@shopify/theme-check-common';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  TextEdit,
} from 'vscode-languageserver';
import { PseudoType, TypeSystem, isArrayType } from '../../TypeSystem';
import { memoize } from '../../utils';
import { AugmentedLiquidSourceCode } from '../../documents';
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

    return options
      .filter(({ name }) => name.startsWith(partial))
      .map((entry) => {
        const { textEdit, format } = this.textEdit(node, params.document, entry);

        return createCompletionItem(
          entry,
          {
            kind: CompletionItemKind.Function,
            insertTextFormat: format,
            textEdit,
          },
          'filter',
        );
      });
  }

  textEdit(
    node: LiquidFilter,
    document: AugmentedLiquidSourceCode,
    entry: MaybeDeprioritisedFilterEntry,
  ): {
    textEdit: TextEdit;
    format: InsertTextFormat;
  } {
    const remainingText = document.source.slice(node.position.end);

    // Match all the way up to the termination of the filter which could be
    // another filter (`|`), or the end of a liquid statement.
    const matchEndOfFilter = remainingText.match(/^(.*?)\s*(?=\||-?\}\}|-?\%\})|^(.*)$/);
    const endOffset = matchEndOfFilter ? matchEndOfFilter[1].length : remainingText.length;

    // The start position for a LiquidFilter node includes the `|`. We need to
    // ignore the pipe and any spaces for our starting position.
    const pipeRegex = new RegExp(`(\\s*\\|\\s*)(?:${node.name}\\}\\})`);
    const matchFilterPipe = node.source.match(pipeRegex);
    const startOffet = matchFilterPipe ? matchFilterPipe[1].length : 0;

    let start = document.textDocument.positionAt(node.position.start + startOffet);
    let end = document.textDocument.positionAt(node.position.end + endOffset);

    const { insertText, insertStyle } = appendRequiredParemeters(entry);

    let newText = insertText;
    let format = insertStyle;

    // If the cursor is inside the filter or at the end and it's the same
    // value as the one we're offering a completion for then we want to restrict
    // the insert to just the name of the filter.
    // e.g. `{{ product | imag█e_url: crop: 'center' }}` and we're offering `imag█e_url`
    const existingFilterOffset = remainingText.match(/[^a-zA-Z_]/)?.index ?? remainingText.length;
    if (node.name + remainingText.slice(0, existingFilterOffset) === entry.name) {
      newText = entry.name;
      format = InsertTextFormat.PlainText;
      end = document.textDocument.positionAt(node.position.end + existingFilterOffset);
    }

    // If the cursor is at the beginning of the string we can consider all
    // options and should not replace any text.
    // e.g. `{{ product | █image_url: crop: 'center' }}`
    // e.g. `{{ product | █ }}`
    if (node.name === CURSOR) {
      end = start;
    }

    return {
      textEdit: TextEdit.replace(
        {
          start,
          end,
        },
        newText,
      ),
      format,
    };
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
