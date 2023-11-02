import { URI } from 'vscode-languageserver';
import { Config, Dependencies as ThemeCheckDependencies } from '@shopify/theme-check-common';

import { WithOptional } from './utils';
import { SettingsSchemaJSONFile } from './settings';

export type Dependencies = WithOptional<RequiredDependencies, 'log'>;

export interface RequiredDependencies {
  /**
   * A basic logging function.
   *
   * You might want console.log in development, and bugsnag in production.
   */
  log(message: string): void;

  /**
   * loadConfig(uri)
   *
   * In local environments, it's possible for one Language Server to deal
   * with a workspace that contains many different configurations. In the
   * browser, it isn't.
   *
   * loadConfig is the runtime-agnostic solution.
   *
   * @example
   *
   * Here's an example VS Code workspace a partner could run
   * ```
   * theme1/
   *   src/
   *     locales/
   *     sections/
   *     snippets/
   *   dist/
   *     locales/
   *     sections/
   *       foo.liquud
   *     snippets/
   * theme2/
   *   locales/
   *   sections/
   *   snippets/
   * ```
   *
   * In this situation, we have 3 different "roots."
   *
   * @param uri - a file path
   * @returns {Promise<Config>}
   */
  loadConfig(uri: URI): Promise<Config>;

  /**
   * In local environments, the Language Server can download the latest versions
   * of themes docset from `Shopify/theme-liquid-docs`. However, this is not
   * possible in the browser, so we implement different solutions for each
   * environment.
   */
  themeDocset: NonNullable<ThemeCheckDependencies['themeDocset']>;

  /**
   * In local environments, the Language Server can download the latest versions
   * of themes schemas from `Shopify/theme-liquid-docs`. Due to limitations in
   * browser environments, json schemas must be precompiled into validators prior
   * to theme-check instantiation.
   */
  schemaValidators: NonNullable<ThemeCheckDependencies['schemaValidators']>;

  /**
   * findRootURI(uri: URI)
   *
   * A function that asynchronously returns the "root" of a theme.
   *
   * Injected because it's different in browser vs in Node.js
   * - In Node.js, we might do a .theme-check.yml algorithm with fs.exists
   * - In browser, we might statically return 'browser:///'
   */
  findRootURI(uri: URI): Promise<URI>;

  /**
   * getDefaultTranslationsFactory(root: URI)
   *
   * Returns the theme-check-js getDefaultTranslations() dependency.
   *
   * A factory because different repos have different default translations.
   */
  getDefaultTranslationsFactory(rootURI: URI): ThemeCheckDependencies['getDefaultTranslations'];

  /**
   * getDefaultLocale(root: URI)
   *
   * Returns the theme-check-js getDefaultLocale() dependency.
   *
   * A factory because different repos have different default locales.
   */
  getDefaultLocaleFactory(rootURI: URI): ThemeCheckDependencies['getDefaultLocale'];

  /**
   * getThemeSettingsSchemaForRootURI(root: URI)
   *
   * Should return parsed contents of the config/settings_schema.json file.
   */
  getThemeSettingsSchemaForRootURI(rootURI: URI): Promise<SettingsSchemaJSONFile>;

  /**
   * filesForURI(uri: URI)
   *
   * Returns all the Liquid and JSON files as an array.
   *
   * Assumes an array of relative paths from root.
   *
   * Optional, used for snippet completion.
   */
  filesForURI?(uri: URI): Promise<string[]>;

  /**
   * Asynchronously computes the file size for a given file. This function is only
   * utilized in a subset of checks. Depending upon the specific use case, initialization
   * complexity can vary. By making this function optional, it allows for flexibility
   * in its invocation, particularly recommended for scenarios where the resulting file
   * size information will be actioned upon.
   *
   * @param {string} absolutePath - The absolute path of the file for which the size is to be computed.
   * @returns {Promise<number>} - A Promise that resolves with the size of the file in bytes.
   *
   * @example
   * fileSize("/absolute/path/to/file")
   *  .then(size => console.log(`File size: ${size} bytes`))
   *  .catch(error => console.error(`Error computing file size: ${error}`));
   */
  fileSize?: ThemeCheckDependencies['fileSize'];

  fileExists: ThemeCheckDependencies['fileExists'];
}
