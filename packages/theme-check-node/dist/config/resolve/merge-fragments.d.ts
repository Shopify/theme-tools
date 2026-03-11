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
export declare function mergeFragments(baseConfigs: ConfigDescription[], config: ConfigFragment): ConfigDescription;
