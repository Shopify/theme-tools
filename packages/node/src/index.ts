import { toLiquidHtmlAST } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import toJSON from 'json-to-ast';

import {
  Config,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  SourceCodeType,
  Theme,
  check as coreCheck,
  recommended,
} from '@shopify/theme-check-common';

import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import glob = require('glob');

const asyncGlob = promisify(glob);

export async function toSourceCode(
  absolutePath: string,
  root: string,
): Promise<LiquidSourceCode | JSONSourceCode | undefined> {
  try {
    const source = await fs.promises.readFile(absolutePath, 'utf8');
    const isLiquid = absolutePath.endsWith('.liquid');

    if (isLiquid) {
      return {
        absolutePath,
        relativePath: path.relative(root, absolutePath),
        source,
        type: SourceCodeType.LiquidHtml,
        ast: toLiquidHtmlAST(source),
      };
    } else {
      return {
        absolutePath,
        relativePath: path.relative(root, absolutePath),
        source,
        type: SourceCodeType.JSON,
        ast: toJSON(source),
      };
    }
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

  return coreCheck(theme, config);
}
