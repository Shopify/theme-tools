import { AbsolutePath } from '../../temp';
import { ConfigFragment } from '../types';
/**
 * Takes an absolute path, parses the yaml at that path and turns it into a
 * ConfigFragment object.
 */
export declare function readYamlConfigDescription(
/** the absolute path to a theme-check.yml file */
absolutePath: AbsolutePath, 
/** only the root config has `extends: theme-check:recommended` by default, it's nothing everywhere else */
isRootConfig?: boolean): Promise<ConfigFragment>;
