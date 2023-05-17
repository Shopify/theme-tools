import { check } from '@shopify/theme-check-common';

import { Dependencies } from '../types';
import { DocumentManager } from '../documents';
import { DiagnosticsManager } from './DiagnosticsManager';
import { useBufferOrInjectedTranslations } from './useBufferOrInjectedTranslations';

export function makeRunChecks({
  loadConfig,
  findRootURI,
  fileExists,
  getDefaultTranslationsFactory,
  getDefaultLocaleFactory,
}: Pick<
  Dependencies,
  | 'loadConfig'
  | 'findRootURI'
  | 'fileExists'
  | 'getDefaultTranslationsFactory'
  | 'getDefaultLocaleFactory'
>) {
  return async function runChecks(
    documentManager: DocumentManager,
    diagnosticsManager: DiagnosticsManager,
    triggerURIs: string[],
  ): Promise<void> {
    // This function takes an array of triggerURIs so that we can correctly
    // recheck on file renames that came from out of bounds in a
    // workspaces.
    //
    // e.g. if a user renames
    //  theme1/snippets/a.liquid to
    //  theme1/snippets/b.liquid
    //
    // then we recheck theme1
    const rootURIs = await Promise.all(triggerURIs.map(findRootURI));
    const deduplicatedRootURIs = new Set(rootURIs);
    await Promise.all([...deduplicatedRootURIs].map(runChecksForRoot));

    return;

    async function runChecksForRoot(rootURI: string) {
      const config = await loadConfig(rootURI);
      const theme = documentManager.theme(rootURI);
      const defaultTranslations = await useBufferOrInjectedTranslations(
        getDefaultTranslationsFactory,
        theme,
        rootURI,
      );

      const offenses = await check(theme, config, {
        getDefaultTranslations: async () => defaultTranslations,
        getDefaultLocale: getDefaultLocaleFactory(rootURI),
        fileExists,
      });

      // We iterate over the theme files (as opposed to offenses) because if
      // there were offenses before, we need to send an empty array to clear
      // them.
      for (const sourceCode of theme) {
        const sourceCodeOffenses = offenses.filter(
          (offense) => offense.absolutePath === sourceCode.absolutePath,
        );
        diagnosticsManager.set(
          sourceCode.uri,
          sourceCode.version,
          sourceCodeOffenses,
        );
      }
    }
  };
}
