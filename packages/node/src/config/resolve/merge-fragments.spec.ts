import { describe, it, expect } from 'vitest';
import { mergeFragments } from './merge-fragments';
import { ConfigDescription, ConfigFragment } from '../types';

const emptyConfig: ConfigDescription = {
  extends: [],
  ignore: [],
  checkSettings: {},
};

describe('Unit: mergeFragments', () => {
  it('merges ConfigDescriptions with a ConfigFragment correctly', () => {
    const baseConfigs: ConfigDescription[] = [
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

    const config: ConfigFragment = {
      ignore: ['node_modules'],
      extends: ['theme-check:recommended'],
      checkSettings: {
        SomeCheck: {
          enabled: false,
        },
      },
    };

    const mergedConfig = mergeFragments(baseConfigs, config);

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
      const baseConfigs: ConfigDescription[] = [
        { ...emptyConfig, root: base[0] },
        { ...emptyConfig, root: base[1] },
      ];

      const config: ConfigFragment = { ...emptyConfig, root: curr };

      const mergedConfig = mergeFragments(baseConfigs, config);
      expect(mergedConfig.root).toEqual(expected);
    });
  });

  it('concatenates ignore configs', () => {
    const baseConfigs: ConfigDescription[] = [
      { ...emptyConfig, ignore: ['a', 'b'] },
      { ...emptyConfig, ignore: ['c', 'd'] },
    ];

    const config: ConfigFragment = { ...emptyConfig, ignore: ['e', 'f'] };

    const mergedConfig = mergeFragments(baseConfigs, config);
    expect(mergedConfig.ignore).to.eql(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('handles empty baseConfigs and config', () => {
    const baseConfigs: ConfigDescription[] = [];
    const config: ConfigFragment = {
      root: './dist',
      ignore: [],
      extends: [],
      checkSettings: {},
    };

    const mergedConfig = mergeFragments(baseConfigs, config);

    expect(mergedConfig).toEqual({
      root: './dist',
      extends: [],
      ignore: [],
      checkSettings: {},
    });
  });

  it('deep merges checkSettings correctly', () => {
    const baseConfigs: ConfigDescription[] = [
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

    const config: ConfigFragment = {
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

    const mergedConfig = mergeFragments(baseConfigs, config);

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
