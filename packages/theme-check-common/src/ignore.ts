import { UriString, CheckDefinition, Config } from './types';
import { minimatch } from 'minimatch';

export function isIgnored(uri: UriString, config: Config, checkDef?: CheckDefinition): boolean {
  const ignorePatterns = [...checkIgnorePatterns(checkDef, config), ...asArray(config.ignore)].map(
    (pattern) =>
      pattern
        .replace(/^\//, config.rootUri + '/') // "absolute patterns" are config.rootUri matches
        .replace(/^([^\/])/, '**/$1') // "relative patterns" are "**/${pattern}"
        .replace(/\/\*$/, '/**'), // "/*" patterns are really "/**"
  );

  return ignorePatterns.some((pattern) => minimatch(uri, pattern));
}

function checkIgnorePatterns(checkDef: CheckDefinition | undefined, config: Config) {
  if (!checkDef) return [];
  return asArray(config.settings[checkDef.meta.code]?.ignore);
}

function asArray<T>(x: T[] | undefined): T[] {
  return x ?? [];
}
