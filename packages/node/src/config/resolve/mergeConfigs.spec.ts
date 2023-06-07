import { describe, it, expect } from 'vitest';
import { mergeConfigs } from './mergeConfigs';
import { FullyResolvedThemeCheckYaml, ThemeCheckYaml } from '../types';

const emptyConfig: FullyResolvedThemeCheckYaml = {
  extends: [],
  ignore: [],
  checkSettings: {},
};

describe('Unit: mergeConfigs', () => {
  it('merges baseConfigs and config correctly', () => {
    const baseConfigs: FullyResolvedThemeCheckYaml[] = [
      {
        root: './dist1',
        extends: [],
        ignore: ['assets'],
        checkSettings: {
          SomeCheck: {
            enabled: true,
            ignore: ['snippets'],
          },
        },
      },
      {
        root: './dist2',
        extends: [],
        ignore: ['config'],
        checkSettings: {
          AnotherCheck: {
            enabled: false,
            ignore: ['templates'],
          },
        },
      },
    ];

    const config: ThemeCheckYaml = {
      ignore: ['node_modules'],
      extends: ['theme-check:recommended'],
      checkSettings: {
        SomeCheck: {
          enabled: false,
        },
      },
    };

    const mergedConfig = mergeConfigs(baseConfigs, config);

    expect(mergedConfig).toEqual({
      root: './dist2',
      extends: [],
      ignore: ['assets', 'config', 'node_modules'],
      checkSettings: {
        SomeCheck: {
          enabled: false,
          ignore: ['snippets'],
        },
        AnotherCheck: {
          enabled: false,
          ignore: ['templates'],
        },
      },
    });
  });

  it('prefers the last root', () => {
    [
      {
        base: ['./base1', undefined],
        curr: './curr',
        expected: './curr',
      },
      {
        base: ['./base1', './base2'],
        curr: undefined,
        expected: './base2',
      },
      {
        base: [undefined, undefined],
        curr: undefined,
        expected: undefined,
      },
    ].forEach(({ base, curr, expected }) => {
      const baseConfigs: FullyResolvedThemeCheckYaml[] = [
        { ...emptyConfig, root: base[0] },
        { ...emptyConfig, root: base[1] },
      ];

      const config: ThemeCheckYaml = { ...emptyConfig, root: curr };

      const mergedConfig = mergeConfigs(baseConfigs, config);
      expect(mergedConfig.root).toEqual(expected);
    });
  });

  it('concatenates ignore configs', () => {
    const baseConfigs: FullyResolvedThemeCheckYaml[] = [
      { ...emptyConfig, ignore: ['a', 'b'] },
      { ...emptyConfig, ignore: ['c', 'd'] },
    ];

    const config: ThemeCheckYaml = { ...emptyConfig, ignore: ['e', 'f'] };

    const mergedConfig = mergeConfigs(baseConfigs, config);
    expect(mergedConfig.ignore).to.eql(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('handles empty baseConfigs and config', () => {
    const baseConfigs: FullyResolvedThemeCheckYaml[] = [];
    const config: ThemeCheckYaml = {
      root: './dist',
      ignore: [],
      extends: [],
      checkSettings: {},
    };

    const mergedConfig = mergeConfigs(baseConfigs, config);

    expect(mergedConfig).toEqual({
      root: './dist',
      extends: [],
      ignore: [],
      checkSettings: {},
    });
  });

  it('deep merges checkSettings correctly', () => {
    const baseConfigs: FullyResolvedThemeCheckYaml[] = [
      {
        root: './dist',
        extends: [],
        ignore: [],
        checkSettings: {
          SomeCheck: {
            enabled: true,
            ignore: ['snippets'],
            key1: 'value1',
            key2: 'value2',
          },
        },
      },
    ];

    const config: ThemeCheckYaml = {
      root: './dist',
      ignore: [],
      extends: [],
      checkSettings: {
        SomeCheck: {
          enabled: false,
          ignore: [],
          key2: 'newValue2',
          key3: 'value3',
        },
      },
    };

    const mergedConfig = mergeConfigs(baseConfigs, config);

    expect(mergedConfig).toEqual({
      root: './dist',
      extends: [],
      ignore: [],
      checkSettings: {
        SomeCheck: {
          enabled: false,
          ignore: [],
          key1: 'value1',
          key2: 'newValue2',
          key3: 'value3',
        },
      },
    });
  });
});
