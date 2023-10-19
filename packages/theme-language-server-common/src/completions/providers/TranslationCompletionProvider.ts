import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { Translations } from '@shopify/theme-check-common';
import { CompletionItem, CompletionItemKind, Range, TextEdit } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { DocumentManager } from '../../documents';
import {
  GetTranslationsForURI,
  PluralizedTranslation,
  PluralizedTranslationKeys,
  renderTranslation,
} from '../../translations';
import { findCurrentNode } from '../../visitor';

export class TranslationCompletionProvider implements Provider {
  constructor(
    private readonly documentManager: DocumentManager,
    private readonly getTranslationsForURI: GetTranslationsForURI,
  ) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);
    const document = this.documentManager.get(params.textDocument.uri);

    if (
      !node ||
      node.type !== NodeTypes.String ||
      !parentNode ||
      parentNode.type !== NodeTypes.LiquidVariable ||
      !document
    ) {
      return [];
    }

    const ast = document.ast as LiquidHtmlNode | Error;
    const textDocument = document.textDocument;

    const translations = await this.getTranslationsForURI(params.textDocument.uri);
    const partial = node.value;
    const options = translationOptions(translations, partial);

    const [_currentNode, realAncestors] =
      ast instanceof Error
        ? [null, []]
        : findCurrentNode(ast, textDocument.offsetAt(params.position));

    // That part feels kind of gross, let me explain...
    // When we complete translations, we also want to append the `| t` after the
    // string, but we should only ever do that if the variable didn't _already_ have that.
    // But since our completion engine works on incomplete code, we need to temporarily
    // fetch the real node to do the optional | t completion.
    const realParentNode = realAncestors.at(-1);
    let shouldAppendTranslateFilter =
      realParentNode?.type === NodeTypes.LiquidVariable && realParentNode?.filters.length === 0;
    const quote = node.single ? "'" : '"';
    let postFix = quote + ' | t';
    let replaceRange: Range;

    if (shouldAppendTranslateFilter) {
      postFix = quote + ' | t';
      replaceRange = {
        start: textDocument.positionAt(node.position.start + 1), // minus the quote characters
        end: textDocument.positionAt(node.position.end), // including quote
      };
    } else {
      postFix = '';
      replaceRange = {
        start: textDocument.positionAt(node.position.start + 1), // minus the quote characters
        end: textDocument.positionAt(node.position.end - 1), // excluding quote
      };
    }

    const insertTextStartIndex = partial.lastIndexOf('.') + 1;

    return options.map(
      (option): CompletionItem => ({
        label: quote + option.path.join('.') + quote + ' | t',
        insertText: option.path.join('.').slice(insertTextStartIndex), // for editors that don't support textEdit
        kind: CompletionItemKind.Field,
        textEdit: TextEdit.replace(replaceRange, option.path.join('.') + postFix),
        documentation: {
          kind: 'markdown',
          value: renderTranslation(option.translation),
        },
      }),
    );
  }
}

type Translation = string | PluralizedTranslation;
type TranslationOption = { path: string[]; translation: Translation };

function isPluralizedTranslation(
  translations: Translations,
): translations is PluralizedTranslation {
  return PluralizedTranslationKeys.some((key) => key in translations);
}

function toOptions(prefix: string[], translations: Translations): TranslationOption[] {
  return Object.entries(translations).flatMap(([path, translation]) => {
    if (typeof translation === 'string' || isPluralizedTranslation(translation)) {
      return [{ path: prefix.concat(path), translation }];
    } else {
      return toOptions(prefix.concat(path), translation);
    }
  });
}

function translationOptions(translations: Translations, partial: string): TranslationOption[] {
  const options = toOptions([], translations);
  return options.filter((option) => option.path.join('.').startsWith(partial));
}
