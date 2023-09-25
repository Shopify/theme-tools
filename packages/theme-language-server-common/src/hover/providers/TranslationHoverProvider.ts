import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, Translations } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { DocumentManager } from '../../documents';

export type GetTranslationsForURI = (uri: string) => Promise<Translations>;

export class TranslationHoverProvider implements BaseHoverProvider {
  constructor(
    public getTranslationsForUri: GetTranslationsForURI,
    public documentManager: DocumentManager,
  ) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);
    if (
      currentNode.type !== NodeTypes.String ||
      !parentNode ||
      parentNode.type !== NodeTypes.LiquidVariable
    ) {
      return null;
    }

    if (!parentNode.filters[0] || !['t', 'translate'].includes(parentNode.filters[0].name)) {
      return null;
    }

    const translations = await this.getTranslationsForUri(params.textDocument.uri);
    const translation = translationValue(currentNode.value, translations);
    const document = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!translation || !document) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: renderTranslation(translation),
      },
      range: {
        start: document.positionAt(currentNode.position.start),
        end: document.positionAt(currentNode.position.end),
      },
    };
  }
}

type PluralizedTranslation = {
  one?: string;
  few?: string;
  many?: string;
  two?: string;
  zero?: string;
  other?: string;
};

function translationValue(
  path: string,
  translations: Translations,
): undefined | string | PluralizedTranslation {
  const parts = path.split('.');
  let current: Translations | string | undefined = translations;
  for (const key of parts) {
    if (!current || typeof current === 'string') {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function renderKey(
  translation: PluralizedTranslation,
  key: keyof PluralizedTranslation,
): string | undefined {
  if (translation[key]) {
    return `\`${key}:\` ${translation[key]}`;
  }
}

function renderTranslation(translation: string | PluralizedTranslation) {
  if (typeof translation === 'string') return translation;
  return [
    renderKey(translation, 'zero'),
    renderKey(translation, 'one'),
    renderKey(translation, 'two'),
    renderKey(translation, 'few'),
    renderKey(translation, 'many'),
    renderKey(translation, 'other'),
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
}
