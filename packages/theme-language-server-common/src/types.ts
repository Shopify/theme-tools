import {
  AbstractFileSystem,
  Config,
  Dependencies as ThemeCheckDependencies,
} from '@shopify/theme-check-common';
import { URI } from 'vscode-languageserver';

import { WithOptional } from './utils';

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
  loadConfig(uri: URI, fs: AbstractFileSystem): Promise<Config>;

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
  jsonValidationSet: NonNullable<ThemeCheckDependencies['jsonValidationSet']>;

  /**
   * A file system abstraction that allows the Language Server to read files by URI.
   *
   * In Node.js, this is a wrapper around node:fs/promises.
   *
   * In VS Code, this is a wrapper around the VS Code API.
   *
   * The browser accepts a custom implementation.
   */
  fs: AbstractFileSystem;
}
