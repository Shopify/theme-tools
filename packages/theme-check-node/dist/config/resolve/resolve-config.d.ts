import { ConfigDescription, ModernIdentifier } from '../types';
import { AbsolutePath } from '../../temp';
/**
 * Given a modern identifier or absolute path, fully resolves and flattens
 * a config description. In other words, extends are all loaded and merged with
 * the config at the configPath.
 */
export declare function resolveConfig(configPath: AbsolutePath | ModernIdentifier, isRootConfig?: boolean): Promise<ConfigDescription>;
