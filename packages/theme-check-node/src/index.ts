import {
  Config,
  DocDefinition,
  JSONSourceCode,
  JSONValidator,
  LiquidSourceCode,
  Offense,
  SectionSchema,
  Theme,
  ThemeBlockSchema,
  toSourceCode as commonToSourceCode,
  check as coreCheck,
  extractDocDefinition,
  filePathSupportsLiquidDoc,
  isBlock,
  isIgnored,
  isSection,
  memo,
  path as pathUtils,
  toSchema,
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

  // Use batch reading if available
  if (NodeFileSystem.readFiles) {
    // Convert absolute paths to URIs for the file system
    const uris = paths.map((absolutePath) => pathUtils.normalize(URI.file(absolutePath)));

    // Batch read all files
    const fileContents = await NodeFileSystem.readFiles(uris);

    // Convert to source codes
    const sourceCodes: (LiquidSourceCode | JSONSourceCode | undefined)[] = [];
    for (const [uri, content] of fileContents) {
      const sourceCode = commonToSourceCode(uri, content);
      sourceCodes.push(sourceCode);
    }

    return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
  } else {
    // Fallback to individual reads
    const sourceCodes = await Promise.all(paths.map(toSourceCode));
    return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
  }
}

export function getThemeFilesPathPattern(rootUri: string) {
  return path
    .normalize(path.join(fileURLToPath(rootUri), '**/*.{liquid,json}'))
    .replace(/\\/g, '/');
}
