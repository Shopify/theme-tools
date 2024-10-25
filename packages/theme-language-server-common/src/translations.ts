import { Translations } from '@shopify/theme-check-common';

export type GetTranslationsForURI = (uri: string) => Promise<Translations>;
export type Translation = string | PluralizedTranslation;
export type TranslationOption = { path: string[]; translation: Translation };

export const PluralizedTranslationKeys = ['one', 'few', 'many', 'two', 'zero', 'other'] as const;
export type PluralizedTranslation = {
  [key in (typeof PluralizedTranslationKeys)[number]]?: string;
};

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

export function isPluralizedTranslation(
  translations: Translations,
): translations is PluralizedTranslation {
  return Object.keys(translations).every((key) => PluralizedTranslationKeys.includes(key as any));
}

export function toOptions(prefix: string[], translations: Translations): TranslationOption[] {
  return Object.entries(translations).flatMap(([path, translation]) => {
    if (typeof translation === 'string' || isPluralizedTranslation(translation)) {
      return [{ path: prefix.concat(path), translation }];
    } else {
      return toOptions(prefix.concat(path), translation);
    }
  });
}

export function translationOptions(translations: Translations): TranslationOption[] {
  return toOptions([], translations);
}

export function extractParams(value: string) {
  const regex = /\{\{([^}]+?)\}\}/g;
  const results = [];
  let current;
  while ((current = regex.exec(value)) !== null) {
    results.push(current[1].trim());
  }
  return results;
}

export function paramsString(params: string[]) {
  if (params.length === 0) return '';
  return `: ` + params.map((param) => `${param}: ${param}`).join(', ');
}
