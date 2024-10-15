import { expect, describe, it } from 'vitest';
import { isIgnored } from './ignore';
import { UriString, CheckDefinition, Config, SourceCodeType } from './types';

const checkDef: CheckDefinition = {
  meta: {
    name: 'Mock Check',
    code: 'MockCheck',
    severity: 0,
    type: SourceCodeType.LiquidHtml,
    docs: {
      description: 'Mock check for testing',
    },
    schema: {},
    targets: [],
  },
  create: () => ({}),
};

describe('Function: isIgnored', () => {
  it('should return false when no ignore patterns are provided', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: [],
        globalIgnore: [],
      }),
      checkDef,
    );
    expect(result).toBe(false);
  });

  it('should return true when the file matches a base ignore pattern', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: ['*.liquid'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return false when the file does not matches a negative pattern', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: ['!snippets/*'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(false);
  });

  it('should return true when the file matches an ignore pattern', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: ['snippets/*.liquid'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return false when the file does not match any ignore patterns', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: ['other-snippets/*.liquid'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(false);
  });

  it('should return true when the file matches a global ignore pattern', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: [],
        globalIgnore: ['snippets/*.liquid'],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return true when the file matches both check-specific and global ignore patterns', () => {
    const result = isIgnored(
      toUri('snippets/foo.liquid'),
      config({
        checkIgnore: ['snippets/*.liquid'],
        globalIgnore: ['snippets/*.liquid'],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return true when the file partially matches an ignore pattern', () => {
    const result = isIgnored(
      toUri('node_modules/some-library/foo.liquid'),
      config({
        checkIgnore: ['node_modules/*'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return true when the file partially matches a non-root ignore pattern', () => {
    const result = isIgnored(
      toUri('some-library/node_modules/foo.liquid'),
      config({
        // any kind of node_modules are ignored
        checkIgnore: ['node_modules/*'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return true when the file matches a non-root /** pattern', () => {
    const result = isIgnored(
      toUri('some-library/node_modules/foo.liquid'),
      config({
        // any kind of node_modules are ignored
        checkIgnore: ['node_modules/**'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(true);
  });

  it('should return false when the file partially matches a root ignore pattern', () => {
    const result = isIgnored(
      toUri('some-library/node_modules/foo.liquid'),
      config({
        // only /root/node_modules/* is ignored, other ones aren't
        checkIgnore: ['/node_modules/*'],
        globalIgnore: [],
      }),
      checkDef,
    );

    expect(result).toBe(false);
  });

  it('should work with only global ignore as well', () => {
    const result = isIgnored(
      toUri('layout/theme.liquid'),
      config({
        checkIgnore: [],
        globalIgnore: ['layout/theme.liquid'],
      }),
    );

    expect(result).toBe(true);
  });
});

function toUri(relativePath: string): UriString {
  return `file:/path/to/${relativePath}`;
}

function config({
  checkIgnore,
  globalIgnore,
}: {
  checkIgnore?: string[];
  globalIgnore?: string[];
}): Config {
  return {
    context: 'theme',
    settings: {
      MockCheck: {
        enabled: true,
        ignore: checkIgnore,
      },
    },
    checks: [],
    rootUri: 'file:/path/to',
    ignore: globalIgnore,
  };
}
