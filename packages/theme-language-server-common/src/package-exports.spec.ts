import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireFromHere = createRequire(__filename);

function resolutionErrorCode(specifier: string): string | undefined {
  try {
    requireFromHere.resolve(specifier);
    return undefined;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code;
  }
}

describe('Module: package exports', () => {
  it.each([
    ['@shopify/theme-language-server-common', 'theme-language-server-common/dist/index.js'],
    ['@shopify/theme-language-server-common/types', 'theme-language-server-common/dist/types.js'],
    [
      '@shopify/theme-language-server-common/package.json',
      'theme-language-server-common/package.json',
    ],
  ])('resolves %s', (specifier, suffix) => {
    expect(requireFromHere.resolve(specifier).replace(/\\/g, '/')).toContain(suffix);
  });

  it.each([
    '@shopify/theme-language-server-common/src/index',
    '@shopify/theme-language-server-common/src/types',
    '@shopify/theme-language-server-common/dist/index',
    '@shopify/theme-language-server-common/dist/types',
  ])('no longer exposes %s', (specifier) => {
    expect(resolutionErrorCode(specifier)).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });
});
