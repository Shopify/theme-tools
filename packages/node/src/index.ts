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
  root: string,
): Promise<LiquidSourceCode | JSONSourceCode | undefined> {
  try {
    const source = await fs.promises.readFile(absolutePath, 'utf8');
    return commonToSourceCode(absolutePath, path.relative(root, absolutePath), source);
  } catch (e) {
    return undefined;
  }
}

export async function getTheme(root: string): Promise<Theme> {
  root = root.startsWith('/') ? `${process.cwd()}/${root}` : root;
  const paths = await asyncGlob(path.join(root, '**/*.{liquid,json}'));
  const fileKVs: [string, LiquidSourceCode | JSONSourceCode | undefined][] = await Promise.all(
    paths.map(async (absolutePath) => [
      path.relative(root, absolutePath),
      await toSourceCode(absolutePath, root),
    ]),
  );
  return {
    files: new Map(fileKVs.filter(([, v]) => !!v) as [string, LiquidSourceCode | JSONSourceCode][]),
  };
}

export async function check(root: string): Promise<Offense[]> {
  const theme = await getTheme(root);
  const config: Config = {
    settings: {},
    checks: recommended,
  };

  return coreCheck(theme, config, {
    fileExists,
    async getDefaultTranslations() {
      // TODO
      return JSON.parse(theme.files.get('locales/en.default.json')?.source || '{}');
    },
  });
}
