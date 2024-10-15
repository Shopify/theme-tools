import { check } from '@shopify/theme-check-common';

import { DocumentManager } from '../documents';
import {
  useBufferOrInjectedSchemaTranslations,
  useBufferOrInjectedTranslations,
} from '../translations';
import { Dependencies } from '../types';
import { DiagnosticsManager } from './DiagnosticsManager';

export function makeRunChecks(
  documentManager: DocumentManager,
  diagnosticsManager: DiagnosticsManager,
  {
    fs,
    loadConfig,
    findRootURI,
    getDefaultTranslationsFactory,
    getDefaultSchemaTranslationsFactory,
    themeDocset,
    jsonValidationSet,
  }: Pick<
    Dependencies,
    | 'fs'
    | 'loadConfig'
    | 'findRootURI'
    | 'getDefaultTranslationsFactory'
    | 'getDefaultSchemaTranslationsFactory'
    | 'themeDocset'
    | 'jsonValidationSet'
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

    async function runChecksForRoot(configFileRootUri: string) {
      const config = await loadConfig(configFileRootUri);
      const rootURI = config.rootUri;
      const theme = documentManager.theme(rootURI);
      const [defaultTranslations, defaultSchemaTranslations] = await Promise.all([
        useBufferOrInjectedTranslations(getDefaultTranslationsFactory, theme, rootURI),
        useBufferOrInjectedSchemaTranslations(getDefaultSchemaTranslationsFactory, theme, rootURI),
      ]);

      const offenses = await check(theme, config, {
        fs,
        getDefaultTranslations: async () => defaultTranslations,
        getDefaultSchemaTranslations: async () => defaultSchemaTranslations,
        jsonValidationSet,
        themeDocset,
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
