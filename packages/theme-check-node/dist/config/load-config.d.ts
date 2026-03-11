import { Config } from '@shopify/theme-check-common';
import { AbsolutePath } from '../temp';
import { ModernIdentifier } from './types';
/**
 * Given an absolute path to a config file, this function returns
 * the validated Config object that it represents.
 *
 * In detail, it does the following:
 *  - resolves and merges extended config,
 *  - resolves the absolute path of the root,
 *  - loads community-provided checks,
 *  - validates check settings.
 */
export declare function loadConfig(
/** The absolute path of config file */
configPath: AbsolutePath | ModernIdentifier | undefined, 
/** The root of the theme */
root: AbsolutePath): Promise<Config>;
