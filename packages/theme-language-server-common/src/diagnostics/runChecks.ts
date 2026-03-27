import {
  check,
  extractStylesheetFromCSS,
  findRoot,
  makeFileExists,
  Offense,
  path,
  recursiveReadDirectory,
  Reference,
  SectionSchema,
  Severity,
  SourceCodeType,
  Stylesheet,
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
    const deduplicatedRootURIs = new Set<string>(rootURIs.filter((x): x is string => !!x));
    await Promise.all([...deduplicatedRootURIs].map(runChecksForRoot));

    return;

    async function runChecksForRoot(configFileRootUri: string) {
      const config = await loadConfig(configFileRootUri, fs);
      const theme = documentManager.theme(config.rootUri);

      const cssOffenses = cssLanguageService
        ? await Promise.all(
            theme.map((sourceCode) => getCSSDiagnostics(cssLanguageService, sourceCode)),
          ).then((offenses) => offenses.flat())
        : [];

      const themeOffenses = await check(theme, config, {
        fs,
        themeDocset,
        jsonValidationSet,
        getMetafieldDefinitions,

        async getReferences(uri: string): Promise<Reference[]> {
          if (!themeGraphManager) return [];
          return themeGraphManager.getReferences(uri);
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

        async getStylesheetTagSelectors() {
          const result = new Map<string, Stylesheet>();
          await documentManager.preload(config.rootUri);

          for (const sourceCode of documentManager.theme(config.rootUri, true)) {
            if (sourceCode.type !== SourceCodeType.LiquidHtml) continue;
            const relativePath = path.relative(sourceCode.uri, config.rootUri);
            const selectors = await sourceCode.getStylesheetSelectors();
            if (selectors) {
              result.set(relativePath, selectors);
            }
          }
          return result;
        },

        async getAssetStylesheetSelectors() {
          const result = new Map<string, Stylesheet>();
          await documentManager.preload(config.rootUri);

          const assetsUri = path.join(config.rootUri, 'assets');
          const cssFiles = await recursiveReadDirectory(
            fs,
            assetsUri,
            ([uri]) => uri.endsWith('.css'),
          );

          for (const fileUri of cssFiles) {
            const cssContent = await fs.readFile(fileUri);
            const relativePath = path.relative(fileUri, config.rootUri);
            const stylesheet = extractStylesheetFromCSS(fileUri, cssContent);
            result.set(relativePath, stylesheet);
          }
          return result;
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
