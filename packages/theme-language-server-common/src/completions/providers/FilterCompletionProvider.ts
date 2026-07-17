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
import { LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem, sortByName } from './common';

export class FilterCompletionProvider implements Provider {
  constructor(private readonly typeSystem: TypeSystem) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { partialAst, node, ancestors, partial, cursor } = params.completionContext;
    if (!node || node.type !== NodeTypes.LiquidFilter) {
      return [];
    }

    // A LiquidFilter only reaches this provider when the caret sits on its
    // name (the finder descends into a covered argument otherwise), so we still
    // offer name completions even when the filter already carries arguments —
    // the text edit below preserves any trailing parameters.

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
    const options = await this.options(isArrayType(inputType) ? 'array' : inputType);

    return options
      .filter(({ name }) => name.startsWith(partial))
      .map((entry) => {
        const { textEdit, format } = this.textEdit(node, params.document, entry, cursor, partial);

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
    cursor: number,
    partial: string,
  ): {
    textEdit: TextEdit;
    format: InsertTextFormat;
  } {
    // `partial` is the text typed from the filter name's start up to the
    // cursor, so the name begins `partial.length` characters before the caret.
    // This keeps the start relative to the cursor rather than deriving it from
    // the pipe-anchored `node.position.start`.
    const nameStart = cursor - partial.length;

    let start = document.textDocument.positionAt(nameStart);
    // By default we replace the whole filter — name and any trailing
    // parameters — so swapping to a different filter doesn't leave the old
    // parameters behind. e.g. `{{ string | d█efault: true }}` -> `downcase`.
    let end = document.textDocument.positionAt(node.position.end);

    const { insertText, insertStyle } = appendRequiredParemeters(entry);

    let newText = insertText;
    let format = insertStyle;

    // If we're offering a completion for the same filter that's already there,
    // we restrict the replacement to just the name so any trailing parameters
    // are left untouched.
    // e.g. `{{ product | imag█e_url: crop: 'center' }}` and we're offering `image_url`
    if (node.name === entry.name) {
      newText = entry.name;
      format = InsertTextFormat.PlainText;
      end = document.textDocument.positionAt(nameStart + node.name.length);
    }

    // If the cursor is at the beginning of the string we can consider all
    // options and should not replace any text.
    // e.g. `{{ product | █image_url: crop: 'center' }}`
    // e.g. `{{ product | █ }}`
    if (node.name === '') {
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
