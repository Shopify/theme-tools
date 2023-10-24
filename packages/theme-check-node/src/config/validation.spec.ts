import { describe, it, expect } from 'vitest';
import { validateConfig } from './validation';
import {
  allChecks,
  Severity,
  Config,
  LiquidCheckDefinition,
  SchemaProp,
  SourceCodeType,
} from '@shopify/theme-check-common';

describe('Unit: validateConfig', () => {
  const ParserBlockingScript = allChecks.find((cd) => cd.meta.code === 'ParserBlockingScript')!;

  it('validates a valid config', () => {
    const config: Config = {
      checks: [ParserBlockingScript],
      settings: {
        ParserBlockingScript: {
          enabled: true,
          severity: Severity.ERROR,
          ignore: ['src/**'],
        },
      },
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('throws an error for missing required setting', () => {
    const checkWithRequiredConfig: LiquidCheckDefinition = {
      meta: {
        name: 'MockCheck',
        code: 'MockCheck',
        docs: {
          description: '...',
        },
        schema: {
          importantSetting: SchemaProp.number(),
        },
        severity: Severity.ERROR,
        targets: [],
        type: SourceCodeType.LiquidHtml,
      },
      create: () => ({}),
    };
    const config: Config = {
      settings: {
        MockCheck: {
          enabled: true,
          severity: Severity.ERROR,
          // missing "importantSetting" setting
        },
      },
      checks: [checkWithRequiredConfig],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).toThrow('Missing required setting: importantSetting');
  });

  it('throws an error for invalid setting type', () => {
    const config: Config = {
      settings: {
        ParserBlockingScript: {
          enabled: true,
          severity: Severity.ERROR,
          ignore: 42 as any, // should be an array of strings
        },
      },
      checks: [ParserBlockingScript],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).toThrow(
      'Invalid type for setting ignore: expected array, got number',
    );
  });

  it('throws an error for unexpected setting', () => {
    const config: Config = {
      settings: {
        ParserBlockingScript: {
          enabled: true,
          severity: Severity.ERROR,
          ignore: ['src/**'],
          extraSetting: 'unexpected', // unexpected setting
        },
      },
      checks: [ParserBlockingScript],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    // TODO fix this test
    // expect(() => validateConfig(config)).toThrow('Unexpected setting: extraSetting');
  });

  it('validates a config with nested schema', () => {
    const nestedCheck: LiquidCheckDefinition = {
      meta: {
        name: 'NestedCheck',
        code: 'NestedCheck',
        severity: Severity.ERROR,
        type: SourceCodeType.LiquidHtml,
        docs: {
          description: 'A check with nested schema',
        },
        schema: {
          propA: SchemaProp.object({
            nestedPropA: SchemaProp.number(),
          }),
        },
        targets: [],
      },
      create: () => ({}),
    };

    const config: Config = {
      settings: {
        NestedCheck: {
          enabled: true,
          severity: Severity.ERROR,
          propA: {
            nestedPropA: 42,
          },
        },
      },
      checks: [nestedCheck],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('throws an error for invalid nested setting type', () => {
    const nestedCheck: LiquidCheckDefinition = {
      meta: {
        name: 'NestedCheck',
        code: 'NestedCheck',
        severity: Severity.ERROR,
        type: SourceCodeType.LiquidHtml,
        docs: {
          description: 'A check with nested schema',
        },
        schema: {
          propA: SchemaProp.object({
            nestedPropA: SchemaProp.number(),
          }),
        },
        targets: [],
      },
      create: () => ({}),
    };

    const config = {
      settings: {
        NestedCheck: {
          enabled: true,
          severity: Severity.ERROR,
          propA: {
            nestedPropA: 'invalid', // should be a number
          },
        },
      },
      checks: [nestedCheck],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).toThrow(
      'Invalid type for setting nestedPropA: expected number, got string',
    );
  });

  it('validates a config with optional settings', () => {
    const optionalCheck: LiquidCheckDefinition = {
      meta: {
        name: 'OptionalCheck',
        code: 'OptionalCheck',
        severity: Severity.ERROR,
        type: SourceCodeType.LiquidHtml,
        docs: {
          description: 'A check with optional settings',
        },
        schema: {
          optionalSetting: SchemaProp.number().optional(),
        },
        targets: [],
      },
      create: () => ({}),
    };

    const config: Config = {
      settings: {
        OptionalCheck: {
          enabled: true,
          severity: Severity.ERROR,
          // "optionalSetting" is not provided
        },
      },
      checks: [optionalCheck],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('validates a config with array settings of different item types', () => {
    const arrayCheck: LiquidCheckDefinition = {
      meta: {
        name: 'ArrayCheck',
        code: 'ArrayCheck',
        severity: Severity.ERROR,
        type: SourceCodeType.LiquidHtml,
        docs: {
          description: 'A check with array settings of different item types',
        },
        schema: {
          stringArray: SchemaProp.array(SchemaProp.string()),
          numberArray: SchemaProp.array(SchemaProp.number()),
        },
        targets: [],
      },
      create: () => ({}),
    };

    const config: Config = {
      settings: {
        ArrayCheck: {
          enabled: true,
          severity: Severity.ERROR,
          stringArray: ['item1', 'item2'],
          numberArray: [1, 2, 3],
        },
      },
      checks: [arrayCheck],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).not.toThrow();
  });

  it('throws an error for invalid array item types', () => {
    const arrayCheck: LiquidCheckDefinition = {
      meta: {
        name: 'ArrayCheck',
        code: 'ArrayCheck',
        severity: Severity.ERROR,
        type: SourceCodeType.LiquidHtml,
        docs: {
          description: 'A check with array settings of different item types',
        },
        schema: {
          stringArray: SchemaProp.array(SchemaProp.string()),
        },
        targets: [],
      },
      create: () => ({}),
    };

    const config: Config = {
      settings: {
        ArrayCheck: {
          enabled: true,
          severity: Severity.ERROR,
          stringArray: ['item1', 42], // Invalid item type (number instead of string)
        },
      },
      checks: [arrayCheck],
      root: '/path/to/root',
      ignore: ['node_modules/**'],
    };

    expect(() => validateConfig(config)).toThrow(
      'Invalid type for setting stringArray: expected string, got number',
    );
  });
});
