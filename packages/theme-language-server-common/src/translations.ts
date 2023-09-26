import { SourceCodeType, Translations } from '@shopify/theme-check-common';
import { AugmentedSourceCode } from './documents';
import { Dependencies } from './types';

export type GetTranslationsForURI = (uri: string) => Promise<Translations>;

export const PluralizedTranslationKeys = ['one', 'few', 'many', 'two', 'zero', 'other'] as const;
export type PluralizedTranslation = {
  [key in (typeof PluralizedTranslationKeys)[number]]?: string;
};

export async function useBufferOrInjectedTranslations(
  getDefaultTranslationsFactory: Dependencies['getDefaultTranslationsFactory'],
  theme: AugmentedSourceCode[],
  rootURI: string,
) {
  const injectedGetDefaultTranslations = getDefaultTranslationsFactory(rootURI);
  const defaultTranslationsSourceCode = theme.find(
    (sourceCode) =>
      sourceCode.type === SourceCodeType.JSON &&
      sourceCode.absolutePath.match(/locales/) &&
      sourceCode.absolutePath.match(/default\.json/),
  );
  return (
    parseDefaultTranslations(defaultTranslationsSourceCode) ||
    (await injectedGetDefaultTranslations())
  );
}

function parseDefaultTranslations(sourceCode: AugmentedSourceCode | undefined) {
  if (!sourceCode) return undefined;
  try {
    return JSON.parse(sourceCode.source);
  } catch (e) {
    return undefined;
  }
}
export function renderKey(
  translation: PluralizedTranslation,
  key: keyof PluralizedTranslation,
): string | undefined {
  if (translation[key]) {
    return `\`${key}:\` ${translation[key]}`;
  }
}

export function renderTranslation(translation: string | PluralizedTranslation) {
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

export function translationValue(
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
