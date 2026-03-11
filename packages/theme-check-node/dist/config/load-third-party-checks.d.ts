import { CheckDefinition, SourceCodeType } from '@shopify/theme-check-common';
import { AbsolutePath } from '../temp';
type ModulePath = string;
export declare function loadThirdPartyChecks(
/**
 * An array of require()-able paths.
 * @example
 * [
 *   '@acme/theme-check-extension',
 *   '/absolute/path/to/checks.js',
 *   './lib/checks.js',
 * ]
 * */
modulePaths?: ModulePath[]): CheckDefinition<SourceCodeType>[];
export declare function findThirdPartyChecks(nodeModuleRoot: AbsolutePath): Promise<ModulePath[]>;
export {};
