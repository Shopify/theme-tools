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
    ['@shopify/theme-check-common', 'theme-check-common/dist/index.js'],
    ['@shopify/theme-check-common/path', 'theme-check-common/dist/path.js'],
    ['@shopify/theme-check-common/test', 'theme-check-common/dist/test/index.js'],
    ['@shopify/theme-check-common/package.json', 'theme-check-common/package.json'],
  ])('resolves %s', (specifier, suffix) => {
    expect(requireFromHere.resolve(specifier).replace(/\\/g, '/')).toContain(suffix);
  });

  it.each([
    '@shopify/theme-check-common/src/index',
    '@shopify/theme-check-common/src/test',
    '@shopify/theme-check-common/dist/index',
    '@shopify/theme-check-common/dist/test',
    '@shopify/theme-check-common/dist/path',
    '@shopify/theme-check-common/dist/utils',
    '@shopify/theme-check-common/dist/disabled-checks',
    '@shopify/theme-check-common/dist/checks/liquid-syntax-error/comment',
    '@shopify/theme-check-common/dist/checks/liquid-syntax-error/javascript',
    '@shopify/theme-check-common/dist/checks/liquid-syntax-error/utils',
  ])('no longer exposes %s', (specifier) => {
    expect(resolutionErrorCode(specifier)).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });

  it('exposes the promoted symbols on the barrel', () => {
    const themeCheckCommon = requireFromHere('@shopify/theme-check-common');

    for (const name of [
      'getPosition',
      'createDisabledChecksModule',
      'UNMATCHED_COMMENT_CLOSE_PARSER_ERROR',
      'UNMATCHED_RAW_CLOSE_PARSER_ERROR',
      'hasRubyAcceptedInertCommentBodyCloser',
      'hasJavascriptClosingTagAfter',
      'hasRubyAcceptedRawTagCloserWithMarkup',
    ]) {
      expect(themeCheckCommon).toHaveProperty(name);
    }
  });
});
