import {
  Config,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  Theme,
  check as coreCheck,
  toSourceCode as commonToSourceCode,
  isIgnored,
} from '@shopify/theme-check-common';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import glob = require('glob');

import { fileExists, fileSize } from './file-utils';
import { loadConfig, findConfigPath } from './config';
import { autofix } from './autofix';

const defaultLocale = 'en';
const asyncGlob = promisify(glob);

export * from '@shopify/theme-check-common';
export { loadConfig };

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

  const offenses = await coreCheck(theme, config, {
    fileExists,
    fileSize,
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
  configPath = configPath ?? (await findConfigPath(root));
  const config = await loadConfig(configPath, root);
  const theme = await getTheme(config);
  return {
    theme,
    config,
  };
}

export async function getTheme(config: Config): Promise<Theme> {
  const paths = await asyncGlob(path.join(config.root, '**/*.{liquid,json}')).then((result) =>
    // Global ignored paths should not be part of the theme
    result.filter((filePath) => !isIgnored(filePath, config)),
  );
  const sourceCodes = await Promise.all(paths.map(toSourceCode));
  return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}
