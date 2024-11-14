import {
  BlockSchema,
  check,
  findRoot,
  makeFileExists,
  path,
  SectionSchema,
  SourceCodeType,
} from '@shopify/theme-check-common';

import { DocumentManager } from '../documents';
import { Dependencies } from '../types';
import { DiagnosticsManager } from './DiagnosticsManager';

export function makeRunChecks(
  documentManager: DocumentManager,
  diagnosticsManager: DiagnosticsManager,
  {
    fs,
    loadConfig,
    themeDocset,
    jsonValidationSet,
    getMetafieldDefinitions,
  }: Pick<
    Dependencies,
    'fs' | 'loadConfig' | 'themeDocset' | 'jsonValidationSet' | 'getMetafieldDefinitions'
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
    const fileExists = makeFileExists(fs);
    const rootURIs = await Promise.all(triggerURIs.map((uri) => findRoot(uri, fileExists)));
    const deduplicatedRootURIs = new Set(rootURIs);
    await Promise.all([...deduplicatedRootURIs].map(runChecksForRoot));

    return;

    async function runChecksForRoot(configFileRootUri: string) {
      const config = await loadConfig(configFileRootUri, fs);
      const theme = documentManager.theme(config.rootUri);
      const offenses = await check(theme, config, {
        fs,
        themeDocset,
        jsonValidationSet,
        getMetafieldDefinitions,
        async getBlockSchema(name) {
          // We won't preload here. If it's available, we'll give it. Otherwise expect nothing.
          const uri = path.join(config.rootUri, 'blocks', `${name}.liquid`);
          const doc = documentManager.get(uri);
          if (doc?.type !== SourceCodeType.LiquidHtml) return undefined;
          return doc.schema as BlockSchema;
        },
        async getSectionSchema(name) {
          // We won't preload here. If it's available, we'll give it. Otherwise expect nothing.
          const uri = path.join(config.rootUri, 'sections', `${name}.liquid`);
          const doc = documentManager.get(uri);
          if (doc?.type !== SourceCodeType.LiquidHtml) return undefined;
          return doc.schema as SectionSchema;
        },
      });

      // We iterate over the theme files (as opposed to offenses) because if
      // there were offenses before, we need to send an empty array to clear
      // them.
      for (const sourceCode of theme) {
        const sourceCodeOffenses = offenses.filter((offense) => offense.uri === sourceCode.uri);
        diagnosticsManager.set(sourceCode.uri, sourceCode.version, sourceCodeOffenses);
      }
    }
  };
}
