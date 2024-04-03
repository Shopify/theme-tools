import { ConfigDescription, ConfigFragment } from '../types';

/**
 * Merges a set of ConfigDescription with a ConfigFragment to obtain a new ConfigDescription.
 *
 * Merge rules:
 *   - The latest `root` is selected, it is not resolved ('./dist' remains './dist')
 *   - `extends` becomes the empty array
 *   - top level `ignore` is extended by concatenation
 *   - checkSettings are deep merged
 */
export function mergeFragments(
  baseConfigs: ConfigDescription[],
  config: ConfigFragment,
): ConfigDescription {
  return {
    // we use the last one defined
    root: selectLatest(
      baseConfigs.map((b) => b.root),
      config.root,
    ),

    // when we're done, there's nothing left to extend
    extends: [],

    // we merge the ignore configs by concatenation
    ignore: baseConfigs.flatMap((b) => b.ignore).concat(config.ignore),

    // we merge the require configs by concatenation
    require: baseConfigs.flatMap((b) => b.require).concat(config.require),

    // we merge deep the settings
    checkSettings: baseConfigs
      .map((b) => b.checkSettings)
      .concat(config.checkSettings)
      .reduce(mergeDeep),

    // We use the last one defined, or default to 'theme'
    context:
      selectLatest(
        baseConfigs.map((b) => b.context),
        config.context,
      ) ?? 'theme',
  };
}

function selectLatest<T>(base: (T | undefined)[], curr: T | undefined): T | undefined {
  return base.concat(curr).filter(Boolean).pop();
}

function mergeDeep<T>(target: T, source: T): T {
  const output = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (isObject(target[key]) && isObject(source[key])) {
        output[key] = mergeDeep(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
  }

  return output;
}

function isObject(item: any): boolean {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}
