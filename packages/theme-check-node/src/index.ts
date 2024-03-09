import {
  Config,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  Theme,
  toSourceCode as commonToSourceCode,
  check as coreCheck,
  isIgnored,
} from '@shopify/theme-check-common';
import { ThemeLiquidDocsManager } from '@shopify/theme-check-docs-updater';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import glob = require('glob');

import { autofix } from './autofix';
import { findConfigPath, loadConfig as resolveConfig } from './config';
import { fileExists, fileSize } from './file-utils';

const defaultLocale = 'en';
const asyncGlob = promisify(glob);

export * from '@shopify/theme-check-common';
export * from './config/types';
export { PathHandler, findRoot, reusableFindRoot } from './find-root';

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
    return commonToSourceCode(absolutePath, source);
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

export async function themeCheckRun(root: string, configPath?: string): Promise<ThemeCheckRun> {
  const { theme, config } = await getThemeAndConfig(root, configPath);
  const defaultTranslationsFile = theme.find((sc) => sc.absolutePath.endsWith('default.json'));
  const defaultTranslations = JSON.parse(defaultTranslationsFile?.source || '{}');
  const themeLiquidDocsManager = new ThemeLiquidDocsManager();

  const offenses = await coreCheck(theme, config, {
    fileExists,
    fileSize,
    themeDocset: themeLiquidDocsManager,
    jsonValidationSet: themeLiquidDocsManager,
    async getDefaultTranslations() {
      return defaultTranslations;
    },
    async getDefaultLocale() {
      if (!defaultTranslationsFile) {
        return defaultLocale;
      }
      const defaultTranslationsFileLocale = defaultTranslationsFile.absolutePath.match(
        /locales\/(.*)\.default\.json$/,
      )?.[1];
      return defaultTranslationsFileLocale || defaultLocale;
    },
  });

  return {
    theme,
    config,
    offenses,
  };
}

async function getThemeAndConfig(
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
  const normalized_path = path.normalize(path.join(config.root, '**/*.{liquid,json}')).replace(/\\/g, '/');
  
  const paths = await asyncGlob(normalized_path).then((result) =>
    // Global ignored paths should not be part of the theme
    result.filter((filePath) => !isIgnored(filePath, config)),
  );
  const sourceCodes = await Promise.all(paths.map(toSourceCode));
  return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}
