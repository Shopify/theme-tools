import {
  ThemeBlockSchema,
  check,
  findRoot,
  makeFileExists,
  path,
  SectionSchema,
  SourceCodeType,
  Offense,
  Severity,
} from '@shopify/theme-check-common';

import { DocumentManager } from '../documents';
import { Dependencies } from '../types';
import { DiagnosticsManager } from './DiagnosticsManager';
import { CSSLanguageService } from '../css/CSSLanguageService';
import { offenseSeverity } from './offenseToDiagnostic';

export function makeRunChecks(
  documentManager: DocumentManager,
  diagnosticsManager: DiagnosticsManager,
  {
    fs,
    loadConfig,
    themeDocset,
    jsonValidationSet,
    getMetafieldDefinitions,
    cssLanguageService,
  }: Pick<
    Dependencies,
    'fs' | 'loadConfig' | 'themeDocset' | 'jsonValidationSet' | 'getMetafieldDefinitions'
  > & { cssLanguageService?: CSSLanguageService },
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
      let cssOffenses: Offense[] = [];
      if (cssLanguageService) {
        for (const sourceCode of theme) {
          if (sourceCode.type !== SourceCodeType.LiquidHtml) continue;
          cssOffenses.push(
            ...(
              await cssLanguageService.diagnostics({
                textDocument: {
                  uri: sourceCode.uri,
                },
              })
            )
              .map(
                (diagnostic) =>
                  ({
                    check: 'css',
                    message: diagnostic.message,
                    end: {
                      index: sourceCode.textDocument.offsetAt(diagnostic.range.end),
                      line: diagnostic.range.end.line,
                      character: diagnostic.range.end.character,
                    },
                    start: {
                      index: sourceCode.textDocument.offsetAt(diagnostic.range.start),
                      line: diagnostic.range.start.line,
                      character: diagnostic.range.start.character,
                    },
                    severity: offenseSeverity(diagnostic),
                    uri: sourceCode.uri,
                    type: SourceCodeType.LiquidHtml,
                  } satisfies Offense),
              )
              .filter((offense) => offense.severity !== Severity.INFO),
          );
        }
      }
      const themeOffenses = await check(theme, config, {
        fs,
        themeDocset,
        jsonValidationSet,
        getMetafieldDefinitions,

        // TODO should do something for app blocks?
        async getBlockSchema(name) {
          // We won't preload here. If it's available, we'll give it. Otherwise expect nothing.
          const uri = path.join(config.rootUri, 'blocks', `${name}.liquid`);
          const doc = documentManager.get(uri);
          if (doc?.type !== SourceCodeType.LiquidHtml) return undefined;
          const schema = await doc.getSchema();
          return schema as ThemeBlockSchema | undefined;
        },

        async getSectionSchema(name) {
          // We won't preload here. If it's available, we'll give it. Otherwise expect nothing.
          const uri = path.join(config.rootUri, 'sections', `${name}.liquid`);
          const doc = documentManager.get(uri);
          if (doc?.type !== SourceCodeType.LiquidHtml) return undefined;
          const schema = await doc.getSchema();
          return schema as SectionSchema | undefined;
        },
      });
      const offenses = [...themeOffenses, ...cssOffenses];

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
