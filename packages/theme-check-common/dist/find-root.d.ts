import { UriString } from './AbstractFileSystem';
type FileExists = (uri: string) => Promise<boolean>;
/**
 * Returns the "root" of a theme or theme app extension. The root is the
 * directory that contains a `.theme-check.yml` file, a `.git` directory, or a
 * `shopify.extension.toml` file.
 *
 * There are cases where .theme-check.yml is not defined and we have to infer the root.
 * We'll assume that the root is the directory that contains a `snippets` directory.
 *
 * So you can think of this function as the function that infers where a .theme-check.yml
 * should be.
 *
 * Note: that this is not the theme root. The config file might have a `root` entry in it
 * that points to somewhere else.
 */
export declare function findRoot(curr: UriString, fileExists: FileExists): Promise<UriString | null>;
export {};
