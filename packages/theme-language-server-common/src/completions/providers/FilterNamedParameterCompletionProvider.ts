import { LiquidVariableLookup, NodeTypes } from '@shopify/liquid-html-parser';
import { ThemeDocset } from '@shopify/theme-check-common';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  TextEdit,
} from 'vscode-languageserver';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem } from './common';
import { AugmentedLiquidSourceCode } from '../../documents';

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

    return filteredOptions.map(({ description, name, types }) => {
      const { textEdit, format } = this.textEdit(node, params.document, name, types[0]);

      return createCompletionItem(
        {
          name,
          description,
        },
        {
          kind: CompletionItemKind.TypeParameter,
          insertTextFormat: format,
          // We want to force these options to appear first in the list given
          // the context that they are being requested in.
          sortText: `1${name}`,
          textEdit,
        },
        'filter',
        Array.isArray(types) ? types[0] : 'unknown',
      );
    });
  }

  textEdit(
    node: LiquidVariableLookup,
    document: AugmentedLiquidSourceCode,
    name: string,
    type: string,
  ): {
    textEdit: TextEdit;
    format: InsertTextFormat;
  } {
    const remainingText = document.source.slice(node.position.end);

    // Match all the way up to the termination of the parameter which could be
    // another parameter (`,`), filter (`|`), or the end of a liquid statement.
    const match = remainingText.match(/^(.*?)\s*(?=,|\||-?\}\}|-?\%\})|^(.*)$/);
    const offset = match ? match[0].length : remainingText.length;
    const existingParameterOffset = remainingText.match(/[^a-zA-Z]/)?.index ?? remainingText.length;

    let start = document.textDocument.positionAt(node.position.start);
    let end = document.textDocument.positionAt(node.position.end + offset);
    let newText = type === 'string' ? `${name}: '$1'` : `${name}: `;
    let format = type === 'string' ? InsertTextFormat.Snippet : InsertTextFormat.PlainText;

    // If the cursor is inside the parameter or at the end and it's the same
    // value as the one we're offering a completion for then we want to restrict
    // the insert to just the name of the parameter.
    // e.g. `{{ product | image_url: cr█op: 'center' }}` and we're offering `crop`
    if (node.name + remainingText.slice(0, existingParameterOffset) == name) {
      newText = name;
      format = InsertTextFormat.PlainText;
      end = document.textDocument.positionAt(node.position.end + existingParameterOffset);
    }

    // If the cursor is at the beginning of the string we can consider all
    // options and should not replace any text.
    // e.g. `{{ product | image_url: █crop: 'center' }}`
    // e.g. `{{ product | image_url: █ }}`
    if (node.name === '█') {
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
}
