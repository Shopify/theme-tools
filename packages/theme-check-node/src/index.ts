import {
  Config,
  DocDefinition,
  JSONSourceCode,
  JSONValidator,
  LiquidHtmlNodeTypes,
  LiquidSourceCode,
  Offense,
  Reference,
  SectionSchema,
  SourceCodeType,
  Stylesheet,
  Theme,
  ThemeBlockSchema,
  toSourceCode as commonToSourceCode,
  check as coreCheck,
  extractDocDefinition,
  extractStylesheetFromCSS,
  extractStylesheetSelectors,
  filePathSupportsLiquidDoc,
  isBlock,
  isIgnored,
  isSection,
  parseJSON,
  memo,
  path as pathUtils,
  toSchema,
  visit,
} from '@shopify/theme-check-common';
import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';
import { isLiquidHtmlNode } from '@shopify/liquid-html-parser';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { URI } from 'vscode-uri';
import glob = require('glob');

import { autofix } from './autofix';
import { findConfigPath, loadConfig as resolveConfig } from './config';
import { NodeFileSystem } from './NodeFileSystem';
import { fileURLToPath } from 'node:url';

const asyncGlob = promisify(glob);

export * from '@shopify/theme-check-common';
export * from './config/types';
export { NodeFileSystem };

export const loadConfig: typeof resolveConfig = async (configPath, root) => {
  configPath ??= await findConfigPath(root);
  return resolveConfig(configPath, root);
};

export type ThemeCheckRun = {
  theme: Theme;
  config: Config;
  offenses: Offense[];
};

export async function toSourceCode(
  absolutePath: string,
): Promise<LiquidSourceCode | JSONSourceCode | undefined> {
  try {
    const source = await fs.readFile(absolutePath, 'utf8');
    return commonToSourceCode(pathUtils.normalize(URI.file(absolutePath)), source);
  } catch (e) {
    return undefined;
  }
}

export async function check(root: string, configPath?: string): Promise<Offense[]> {
  const run = await themeCheckRun(root, configPath);
  return run.offenses;
}

export async function checkAndAutofix(root: string, configPath?: string) {
  const { theme, offenses } = await themeCheckRun(root, configPath);
  await autofix(theme, offenses);
}

export async function themeCheckRun(
  root: string,
  configPath?: string,
  log: (message: string) => void = () => {},
): Promise<ThemeCheckRun> {
  const { theme, config } = await getThemeAndConfig(root, configPath);
  const themeLiquidDocsManager = new ThemeLiquidDocsManager(log);

  // This does feel a bit heavy handed, but I'm in a rush.
  //
  // Ultimately, I want to be able to have type safety on the parsed content
  // of the {% schema %} tags if the schema is known to be valid. This should make
  // {% schema %} related theme checks much easier to write than having to write visitor
  // code and doing null checks all over the place. `ThemeBlock.Schema` is much more specific
  // than `any` ever could be.
  //
  // I also want to have the option of passing down the getSectionSchema &
  // getBlockSchema functions as dependencies. This will enable me to cache the
  // results in the language server and avoid redoing validation between runs if
  // we know the schema of a file that didn't change is valid.
  //
  // The crux of my problem is that I want to be passing down the json validation set
  // as dependencies and not a full blown language service. But the easiest way
  // is to have a `isValidSchema` is to have the language service do the
  // validation of the JSON schema... We're technically going to have two
  // JSONValidator running in theme check (node). We already have two in the
  // language server.
  const validator = await JSONValidator.create(themeLiquidDocsManager, config);
  const isValidSchema = validator?.isValid;

  // We can assume that all files are loaded when running themeCheckRun
  const schemas = theme.map((source) =>
    toSchema(config.context, source.uri, source, isValidSchema),
  );

  // prettier-ignore
  const blockSchemas = new Map(theme.filter(source => isBlock(source.uri)).map((source) => [
    path.basename(source.uri, '.liquid'),
    memo(async (): Promise<ThemeBlockSchema | undefined> =>
      toSchema(config.context, source.uri, source, isValidSchema) as Promise<ThemeBlockSchema | undefined>
    )
  ]));
  // prettier-ignore
  const sectionSchemas = new Map(theme.filter(source => isSection(source.uri)).map((source) => [
    path.basename(source.uri, '.liquid'),
    memo(async (): Promise<SectionSchema | undefined> =>
      toSchema(config.context, source.uri, source, isValidSchema) as Promise<SectionSchema | undefined>
    )
  ]));
  const docDefinitions = new Map(
    theme.map((file) => [
      path.relative(URI.file(root).toString(), file.uri),
      memo(async (): Promise<DocDefinition | undefined> => {
        const ast = file.ast;
        if (!isLiquidHtmlNode(ast)) {
          return undefined;
        }
        if (!filePathSupportsLiquidDoc(file.uri)) {
          return undefined;
        }
        return extractDocDefinition(file.uri, ast);
      }),
    ]),
  );
  const stylesheetTagSelectors = new Map(
    theme.map((file) => [
      path.relative(URI.file(root).toString(), file.uri),
      memo(async (): Promise<Stylesheet | undefined> => {
        const ast = file.ast;
        if (!isLiquidHtmlNode(ast)) {
          return undefined;
        }
        return extractStylesheetSelectors(file.uri, ast);
      }),
    ]),
  );

  // Get all CSS files in assets folder
  const assetsPath = path.join(root, 'assets');
  let cssFilePaths: string[] = [];
  try {
    cssFilePaths = await asyncGlob('**/*.css', { cwd: assetsPath });
  } catch {
    // Ignore errors (e.g., assets folder doesn't exist)
  }

  const assetStylesheetSelectors = new Map(
    cssFilePaths.map((cssFile) => [
      `assets/${cssFile}`,
      memo(async (): Promise<Stylesheet | undefined> => {
        const absolutePath = path.join(assetsPath, cssFile);
        try {
          const cssContent = await fs.readFile(absolutePath, 'utf-8');
          const uri = URI.file(absolutePath).toString();
          return extractStylesheetFromCSS(uri, cssContent);
        } catch {
          return undefined;
        }
      }),
    ]),
  );

  // Build a reverse reference map so getReferences works in CLI mode.
  // Covers {% render 'snippet' %}, {% section 'name' %}, and
  // {% content_for 'block', type: '<block-name>' %} (direct references).
  const referencesByTarget = new Map<string, Reference[]>();
  const rootUri = URI.file(root).toString();
  for (const file of theme) {
    const ast = file.ast;
    if (!isLiquidHtmlNode(ast)) continue;
    visit<SourceCodeType.LiquidHtml, void>(ast, {
      RenderMarkup(node) {
        const snippet = node.snippet;
        if (typeof snippet !== 'string' && snippet.type === LiquidHtmlNodeTypes.String) {
          const snippetUri = pathUtils.join(rootUri, 'snippets', `${snippet.value}.liquid`);
          const refs = referencesByTarget.get(snippetUri) ?? [];
          refs.push({ type: 'direct', source: { uri: file.uri }, target: { uri: snippetUri } });
          referencesByTarget.set(snippetUri, refs);
        }
      },
      LiquidTag(node) {
        const markup = node.markup;
        if (typeof markup === 'string' || Array.isArray(markup)) return;

        if (node.name === 'section') {
          if ((markup as any).type !== LiquidHtmlNodeTypes.String) return;
          const sectionName = (markup as any).value as string;
          const sectionUri = pathUtils.join(rootUri, 'sections', `${sectionName}.liquid`);
          const refs = referencesByTarget.get(sectionUri) ?? [];
          refs.push({ type: 'direct', source: { uri: file.uri }, target: { uri: sectionUri } });
          referencesByTarget.set(sectionUri, refs);
        } else if (node.name === 'content_for') {
          if ((markup as any).contentForType?.value !== 'block') return;
          const blockTypeArg = (markup as any).args?.find((arg: any) => arg.name === 'type');
          if (!blockTypeArg || blockTypeArg.value.type !== LiquidHtmlNodeTypes.String) return;
          const blockName = blockTypeArg.value.value as string;
          const blockUri = pathUtils.join(rootUri, 'blocks', `${blockName}.liquid`);
          const refs = referencesByTarget.get(blockUri) ?? [];
          refs.push({ type: 'direct', source: { uri: file.uri }, target: { uri: blockUri } });
          referencesByTarget.set(blockUri, refs);
        }
      },
      LiquidRawTag(node) {
        if (node.name !== 'schema') return;
        if (!isSection(file.uri) && !isBlock(file.uri)) return;
        const parsed = parseJSON(node.body.value, undefined, false);
        if (parsed instanceof Error || !Array.isArray(parsed?.blocks)) return;
        for (const block of parsed.blocks) {
          const blockType = block?.type;
          if (typeof blockType !== 'string' || !blockType.startsWith('_')) continue;
          const blockUri = pathUtils.join(rootUri, 'blocks', `${blockType}.liquid`);
          const refs = referencesByTarget.get(blockUri) ?? [];
          refs.push({ type: 'direct', source: { uri: file.uri }, target: { uri: blockUri } });
          referencesByTarget.set(blockUri, refs);
        }
      },
    });
  }

  const offenses = await coreCheck(theme, config, {
    fs: NodeFileSystem,
    themeDocset: themeLiquidDocsManager,
    jsonValidationSet: themeLiquidDocsManager,

    // This is kind of gross, but we want those things to be lazy and called by name so...
    // In the language server, this is memo'ed in DocumentManager, but we don't have that kind
    // of luxury in CLI-mode.
    getSectionSchema: async (name) => sectionSchemas.get(name)?.(),
    getBlockSchema: async (name) => blockSchemas.get(name)?.(),
    getAppBlockSchema: async (name) => blockSchemas.get(name)?.() as any, // cheating... but TODO
    getDocDefinition: async (relativePath) => docDefinitions.get(relativePath)?.(),
    getReferences: async (uri: string) => referencesByTarget.get(uri) ?? [],
    getStylesheetTagSelectors: async () => {
      const result = new Map<string, Stylesheet>();
      for (const [relativePath, getSelectors] of stylesheetTagSelectors) {
        const selectors = await getSelectors();
        if (selectors) {
          result.set(relativePath, selectors);
        }
      }
      return result;
    },
    getAssetStylesheetSelectors: async () => {
      const result = new Map<string, Stylesheet>();
      for (const [relativePath, getSelectors] of assetStylesheetSelectors) {
        const selectors = await getSelectors();
        if (selectors) {
          result.set(relativePath, selectors);
        }
      }
      return result;
    },
  });

  return {
    theme,
    config,
    offenses,
  };
}

export async function getThemeAndConfig(
  root: string,
  configPath?: string,
): Promise<{ theme: Theme; config: Config }> {
  const config = await loadConfig(configPath, root);
  const theme = await getTheme(config);
  return {
    theme,
    config,
  };
}

export async function getTheme(config: Config): Promise<Theme> {
  // On windows machines - the separator provided by path.join is '\'
  // however the glob function fails silently since '\' is used to escape glob charater
  // as mentioned in the documentation of node-glob

  // the path is normalised and '\' are replaced with '/' and then passed to the glob function
  let normalizedGlob = getThemeFilesPathPattern(config.rootUri);

  const paths = await asyncGlob(normalizedGlob, { absolute: true }).then((result) =>
    // Global ignored paths should not be part of the theme
    result.filter((filePath) => !isIgnored(filePath, config)),
  );
  const sourceCodes = await Promise.all(paths.map(toSourceCode));
  return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

export function getThemeFilesPathPattern(rootUri: string) {
  return path
    .normalize(path.join(fileURLToPath(rootUri), '**/*.{liquid,json}'))
    .replace(/\\/g, '/');
}
