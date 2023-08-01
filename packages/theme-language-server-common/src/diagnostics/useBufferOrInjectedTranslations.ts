import { SourceCodeType } from '@shopify/theme-check-common';

import { AugmentedSourceCode } from '../documents';
import { Dependencies } from '../types';

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
