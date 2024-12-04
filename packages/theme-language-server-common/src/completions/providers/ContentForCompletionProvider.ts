import { LiquidString, NodeTypes } from '@shopify/liquid-html-parser';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

export class ContentForCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { document } = params;
    const doc = document.textDocument;
    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.String ||
      parentNode.type !== NodeTypes.ContentForMarkup
    ) {
      return [];
    }

    const options = [
      {
        keyword: 'block',
        description: 'Renders a static theme block within `sections` or `theme blocks`.\n',
        syntax: "content_for 'block', type: '$1', id: '$2'",
      },
      {
        keyword: 'blocks',
        description: `Renders block elements within sections or other blocks as configured in the JSON template or section groups.
See [theme blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks)
to see how to create theme blocks that can be used this way.\n`,
        syntax: `content_for 'blocks'`,
      },
    ];

    const partial = node.value;
    const isInLiquidLiquidTag = ancestors.some(
      (node) => node.type === NodeTypes.LiquidTag && node.name === 'liquid',
    );
    const startPosition = node.position.start + 1; // after the quote
    const endPosition = indexOf(
      document.source,
      // We want to maintain trailing whitespace to whatever it was before the completion
      isInLiquidLiquidTag ? / *\n/g : /\s*-?%}/gm,
      startPosition + partial.length,
    );
    const hasMarkup =
      document.source
        .slice(startPosition + partial.length, endPosition)
        .replace(/^['"]/, '')
        .trim() !== '';
    const shouldCompleteSyntax = endPosition !== -1 && !hasMarkup;

    return options
      .filter(({ keyword }) => keyword.startsWith(partial))
      .map(({ keyword, description, syntax }): CompletionItem => {
        const item: CompletionItem = {
          label: keyword,
          kind: CompletionItemKind.Keyword,
          insertTextFormat: InsertTextFormat.PlainText,
          documentation: {
            kind: 'markdown',
            value: description,
          },
        };

        if (shouldCompleteSyntax) {
          const snippetText = getSnippetText(node, syntax);
          item.insertTextFormat = InsertTextFormat.Snippet;
          item.textEdit = TextEdit.replace(
            Range.create(doc.positionAt(startPosition), doc.positionAt(endPosition)),
            snippetText,
          );
        }

        return item;
      });
  }
}

function getSnippetText(node: LiquidString, syntax: string): string {
  // Language clients don't like it when the text edit starts before the word being completed
  // So we make the snippet text start with the word being completed
  return (
    syntax
      .replace(/^content_for '/, '')
      // use the same quote type as the original string everywhere in the snippet
      .replace(node.single ? /"/g : /'/g, node.single ? "'" : '"')
  );
}

/**
 * String.prototype.indexOf does not accept RegExp args...
 * String.prototype.search does not accept fromIndex args...
 *
 * We want both.
 */
function indexOf(string: string, searchValue: RegExp, fromIndex: number): number {
  searchValue.lastIndex = fromIndex;
  const match = searchValue.exec(string);
  return match ? match.index : -1;
}
