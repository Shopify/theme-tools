import {
  check,
  extractCSSClassesFromLiquidUri,
  extractCSSClassesFromAssetUri,
  findRoot,
  makeFileExists,
  Offense,
  path,
  Reference,
  SectionSchema,
  Severity,
  SourceCodeType,
  ThemeBlockSchema,
} from '@shopify/theme-check-common';

import { CSSLanguageService } from '../css/CSSLanguageService';
import { AugmentedSourceCode, DocumentManager } from '../documents';
import { Dependencies } from '../types';
import { DiagnosticsManager } from './DiagnosticsManager';
import { offenseSeverity } from './offenseToDiagnostic';
import { ThemeGraphManager } from '../server/ThemeGraphManager';

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
    themeGraphManager,
  }: Pick<
    Dependencies,
    'fs' | 'loadConfig' | 'themeDocset' | 'jsonValidationSet' | 'getMetafieldDefinitions'
  > & { cssLanguageService?: CSSLanguageService; themeGraphManager?: ThemeGraphManager },
) {
  // Session-scoped cache of CSS classes per file URI. Living at the
  // makeRunChecks scope means each save only re-parses files that actually
  // changed — ValidScopedCSSClass's per-save full-theme scan drops from
  // O(files-with-stylesheet) parses to O(1) re-parse of the saved file.
  const cssClassCache = new Map<string, Promise<Set<string>>>();

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
    const runStart = Date.now();
    console.error(
      `[theme-check] runChecks start — ${triggerURIs.length} trigger URI(s): ${triggerURIs
        .map((u) => u.split('/').pop())
        .join(', ')}`,
    );
    // Evict changed files from the session cache before running.
    for (const uri of triggerURIs) cssClassCache.delete(uri);
    const fileExists = makeFileExists(fs);
    const rootURIs = await Promise.all(triggerURIs.map((uri) => findRoot(uri, fileExists)));
    const deduplicatedRootURIs = new Set<string>(rootURIs.filter((x): x is string => !!x));
    await Promise.all([...deduplicatedRootURIs].map(runChecksForRoot));
    console.error(`[theme-check] runChecks done in ${Date.now() - runStart}ms`);

    return;

    async function runChecksForRoot(configFileRootUri: string) {
      const rootStart = Date.now();
      const config = await loadConfig(configFileRootUri, fs);
      const theme = documentManager.theme(config.rootUri);
      console.error(
        `[theme-check]   root ${config.rootUri.split('/').slice(-2).join('/')} — ${
          theme.length
        } file(s)`,
      );

      const cssStart = Date.now();
      const cssOffenses = cssLanguageService
        ? await Promise.all(
            theme.map((sourceCode) => getCSSDiagnostics(cssLanguageService, sourceCode)),
          ).then((offenses) => offenses.flat())
        : [];
      console.error(`[theme-check]   cssDiagnostics: ${Date.now() - cssStart}ms`);

      const checkStart = Date.now();
      const themeOffenses = await check(theme, config, {
        fs,
        themeDocset,
        jsonValidationSet,
        getMetafieldDefinitions,

        async getReferences(uri: string): Promise<Reference[]> {
          if (!themeGraphManager) return [];
          return themeGraphManager.getReferences(uri);
        },

        async getDependencies(uri: string): Promise<Reference[]> {
          if (!themeGraphManager) return [];
          return themeGraphManager.getDependencies(uri);
        },

        getCSSClassesForURI(uri: string): Promise<Set<string>> {
          const cached = cssClassCache.get(uri);
          if (cached) return cached;
          const promise = uri.endsWith('.css')
            ? extractCSSClassesFromAssetUri(uri, fs)
            : extractCSSClassesFromLiquidUri(uri, fs);
          cssClassCache.set(uri, promise);
          return promise;
        },

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

        async getDocDefinition(relativePath) {
          const uri = path.join(config.rootUri, relativePath);
          const doc = documentManager.get(uri);
          if (doc?.type !== SourceCodeType.LiquidHtml) return undefined;
          return doc.getLiquidDoc();
        },
      });
      console.error(
        `[theme-check]   check() (all rules): ${Date.now() - checkStart}ms — ${
          themeOffenses.length
        } offense(s)`,
      );
      const offenses = [...themeOffenses, ...cssOffenses];

      // We iterate over the theme files (as opposed to offenses) because if
      // there were offenses before, we need to send an empty array to clear
      // them.
      for (const sourceCode of theme) {
        const sourceCodeOffenses = offenses.filter((offense) => offense.uri === sourceCode.uri);
        diagnosticsManager.set(sourceCode.uri, sourceCode.version, sourceCodeOffenses);
      }
      console.error(`[theme-check]   root done in ${Date.now() - rootStart}ms`);
    }
  };
}

async function getCSSDiagnostics(
  cssLanguageService: CSSLanguageService,
  sourceCode: AugmentedSourceCode,
): Promise<Offense[]> {
  if (sourceCode.type !== SourceCodeType.LiquidHtml) {
    return [];
  }

  const diagnostics = await cssLanguageService.diagnostics({
    textDocument: { uri: sourceCode.uri },
  });

  return diagnostics
    .map(
      (diagnostic): Offense => ({
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
      }),
    )
    .filter((offense) => offense.severity !== Severity.INFO);
}
