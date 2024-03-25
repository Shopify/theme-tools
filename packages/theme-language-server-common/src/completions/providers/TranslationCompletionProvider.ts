import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { CompletionItem, CompletionItemKind, Range, TextEdit } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import {
  GetTranslationsForURI,
  extractParams,
  paramsString,
  renderTranslation,
  translationOptions,
} from '../../translations';
import { findCurrentNode } from '../../visitor';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

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

    // We only want to show standard translations to complete if the translation
    // is prefixed by shopify. Otherwise it's too noisy.
    const options = translationOptions(translations).filter(
      (option) => !option.path[0]?.startsWith('shopify') || partial.startsWith('shopify'),
    );

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

    return options.map(({ path, translation }): CompletionItem => {
      const params = extractParams(
        typeof translation === 'string' ? translation : Object.values(translation)[0] ?? '',
      );
      const parameters = paramsString(params);
      return {
        label: quote + path.join('.') + quote + ' | t', // don't want the count here because it feels noisy(?)
        insertText: path.join('.').slice(insertTextStartIndex), // for editors that don't support textEdit
        kind: CompletionItemKind.Field,
        textEdit: TextEdit.replace(
          replaceRange,
          path.join('.') + postFix + (shouldAppendTranslateFilter ? parameters : ''),
        ),
        documentation: {
          kind: 'markdown',
          value: renderTranslation(translation),
        },
      };
    });
  }
}
