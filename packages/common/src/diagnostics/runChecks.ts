import { check } from '@shopify/theme-check-common';

import { Dependencies } from '../types';
import { DocumentManager } from '../documents';
import { DiagnosticsManager } from './DiagnosticsManager';
import { offenseToDiagnostic } from './offenseToDiagnostic';
import { useBufferOrInjectedTranslations } from './useBufferOrInjectedTranslations';

export function makeRunChecks({
  loadConfig,
  findRootURI,
  fileExists,
  getDefaultTranslationsFactory,
}: Pick<
  Dependencies,
  'loadConfig' | 'findRootURI' | 'fileExists' | 'getDefaultTranslationsFactory'
>) {
  return async function runChecks(
    documentManager: DocumentManager,
    diagnosticsManager: DiagnosticsManager,
    triggerUri: string,
  ): Promise<void> {
    const [config, rootURI] = await Promise.all([
      loadConfig(triggerUri),
      findRootURI(triggerUri),
    ]);
    const theme = documentManager.theme(rootURI);
    const defaultTranslations = await useBufferOrInjectedTranslations(
      getDefaultTranslationsFactory,
      theme,
      rootURI,
    );

    const offenses = await check(theme, config, {
      getDefaultTranslations: async () => defaultTranslations,
      fileExists,
    });

    // We iterate over the theme files (as opposed to offenses) because if
    // there were offenses before, we need to send an empty array to clear
    // them.
    for (const sourceCode of theme) {
      const diagnostics = offenses
        .filter((offense) => offense.absolutePath === sourceCode.absolutePath)
        .map(offenseToDiagnostic);
      diagnosticsManager.set(sourceCode.uri, sourceCode.version, diagnostics);
    }
  };
}
