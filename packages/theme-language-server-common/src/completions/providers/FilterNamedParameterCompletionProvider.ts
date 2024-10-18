import { NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem } from './common';
import { ThemeDocset } from '@shopify/theme-check-common';
import { render, type DocsetEntryType } from '../../docset';

export class FilterNamedParameterCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node } = params.completionContext;
    if (!node || node.type !== NodeTypes.VariableLookup) {
      return [];
    }

    if (!node.name || node.lookups.length > 0) {
      // We only do top level in this one.
      return [];
    }

    const partial = node.name.replace(CURSOR, '');
    const currentContext = params.completionContext.ancestors.at(-1);

    if (!currentContext || currentContext?.type !== NodeTypes.LiquidFilter) {
      return [];
    }

    const filters = await this.themeDocset.filters();
    const foundFilter = filters.find((f) => f.name === currentContext.name);

    if (!foundFilter?.parameters) {
      return [];
    }

    const filteredOptions = foundFilter.parameters.filter(
      (p) => !p.positional && p.name.startsWith(partial),
    );

    return filteredOptions.map(({ description, name, types }) =>
      createCompletionItem(
        {
          name,
          description,
        },
        {
          kind: CompletionItemKind.TypeParameter,
          insertText: types[0] === 'string' ? `${name}: '$1'` : `${name}: `,
          insertTextFormat:
            types[0] === 'string' ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
          // We want to force these options to appear first in the list given
          // the context that they are being requested in.
          sortText: `1${name}`,
        },
        'filter',
        Array.isArray(types) ? types[0] : 'unknown',
      ),
    );
  }
}
