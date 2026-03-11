import { Config } from '@shopify/theme-check-common';
import { AbsolutePath } from '../temp';
import { ConfigDescription } from './types';
/**
 * Creates the checks array, loads node modules checks and validates
 * settings against the respective check schemas.
 *
 * Effectively "loads" a ConfigDescription into a Config.
 */
export declare function loadConfigDescription(configDescription: ConfigDescription, root: AbsolutePath): Promise<Config>;
