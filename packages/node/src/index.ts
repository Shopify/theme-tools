import {
  Config,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  Theme,
  check as coreCheck,
  toSourceCode as commonToSourceCode,
  recommended,
} from '@shopify/theme-check-common';

import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import glob = require('glob');

const asyncGlob = promisify(glob);
const fileExists = promisify(fs.exists);

export async function toSourceCode(
  absolutePath: string,
): Promise<LiquidSourceCode | JSONSourceCode | undefined> {
  try {
    const source = await fs.promises.readFile(absolutePath, 'utf8');
    return commonToSourceCode(absolutePath, source);
  } catch (e) {
    return undefined;
  }
}

export async function getTheme(root: string): Promise<Theme> {
  root = root.startsWith('/') ? `${process.cwd()}/${root}` : root;
  const paths = await asyncGlob(path.join(root, '**/*.{liquid,json}'));
  const sourceCodes = await Promise.all(paths.map(toSourceCode));
  return sourceCodes.filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

export async function check(root: string): Promise<Offense[]> {
  const theme = await getTheme(root);
  const config: Config = {
    settings: {},
    checks: recommended,
    root,
  };
  const defaultLocale = 'en';
  const defaultTranslationsFile = theme.find((sc) => sc.absolutePath.endsWith('default.json'));
  const defaultTranslations = JSON.parse(defaultTranslationsFile?.source || '{}');

  return coreCheck(theme, config, {
    fileExists,
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
}
