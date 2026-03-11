import { Translations } from '@shopify/theme-check-common';
export type GetTranslationsForURI = (uri: string) => Promise<Translations>;
export type Translation = string | PluralizedTranslation;
export type TranslationOption = {
    path: string[];
    translation: Translation;
};
export declare const PluralizedTranslationKeys: readonly ["one", "few", "many", "two", "zero", "other"];
export type PluralizedTranslation = {
    [key in (typeof PluralizedTranslationKeys)[number]]?: string;
};
export declare function renderKey(translation: PluralizedTranslation, key: keyof PluralizedTranslation): string | undefined;
export declare function renderTranslation(translation: string | PluralizedTranslation): string;
export declare function translationValue(path: string, translations: Translations): undefined | string | PluralizedTranslation;
export declare function isPluralizedTranslation(translations: Translations): translations is PluralizedTranslation;
export declare function toOptions(prefix: string[], translations: Translations): TranslationOption[];
export declare function translationOptions(translations: Translations): TranslationOption[];
export declare function extractParams(value: string): string[];
export declare function paramsString(params: string[]): string;
