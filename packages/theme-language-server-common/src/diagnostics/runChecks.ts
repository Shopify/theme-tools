import { check } from '@shopify/theme-check-common';

import { Dependencies } from '../types';
import { DocumentManager } from '../documents';
import { DiagnosticsManager } from './DiagnosticsManager';
import { useBufferOrInjectedTranslations } from '../translations';
import { URI } from 'vscode-uri';

export function makeRunChecks(
  documentManager: DocumentManager,
  diagnosticsManager: DiagnosticsManager,
  {
    loadConfig,
    findRootURI,
    fileSize,
    fileExists,
    getDefaultTranslationsFactory,
    getDefaultLocaleFactory,
    themeDocset,
    schemaValidators,
  }: Pick<
    Dependencies,
    | 'loadConfig'
    | 'findRootURI'
    | 'fileExists'
    | 'fileSize'
    | 'getDefaultTranslationsFactory'
    | 'getDefaultLocaleFactory'
    | 'themeDocset'
    | 'schemaValidators'
  >,
) {
  return async function runChecks(triggerURIs: string[]): Promise<void> {
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

    async function runChecksForRoot(configFileRoot: string) {
      const configFileRootURI = URI.parse(configFileRoot);
      const config = await loadConfig(configFileRoot);
      const rootURI = configFileRootURI.with({
        path: config.root,
      });
      const theme = documentManager.theme(rootURI.toString());
      const defaultTranslations = await useBufferOrInjectedTranslations(
        getDefaultTranslationsFactory,
        theme,
        rootURI.toString(),
      );

      const offenses = await check(theme, config, {
        fileExists,
        fileSize,
        getDefaultLocale: getDefaultLocaleFactory(rootURI.toString()),
        getDefaultTranslations: async () => defaultTranslations,
        themeDocset,
        schemaValidators,
      });

      // We iterate over the theme files (as opposed to offenses) because if
      // there were offenses before, we need to send an empty array to clear
      // them.
      for (const sourceCode of theme) {
        const sourceCodeOffenses = offenses.filter(
          (offense) => offense.absolutePath === sourceCode.absolutePath,
        );
        diagnosticsManager.set(sourceCode.uri, sourceCode.version, sourceCodeOffenses);
      }
    }
  };
}
