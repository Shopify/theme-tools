import {
  AbstractFileSystem,
  Config,
  Dependencies as ThemeCheckDependencies,
} from '@shopify/theme-check-common';
import { URI } from 'vscode-languageserver';
import * as rpc from 'vscode-jsonrpc';

import { WithOptional } from './utils';
import { Range } from 'vscode-json-languageservice';
import { Reference } from '@shopify/theme-graph';

export type Dependencies = WithOptional<
  RequiredDependencies,
  'log' | 'getMetafieldDefinitions' | 'fetchMetafieldDefinitionsForURI'
>;

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

  /**
   * In local environments, the Language Server can download the metafield definitions
   * and provide a set of memoized definitions. In other environments, we rely on dynamically
   * fetching the set of metafield definitions every time.
   */
  getMetafieldDefinitions: ThemeCheckDependencies['getMetafieldDefinitions'];

  /**
   * Fetch Metafield definitions using the CLI provided the URI of the project root.
   * This should only be used in node environments; not on the browser.
   */
  fetchMetafieldDefinitionsForURI: (uri: URI) => Promise<void>;
}

export namespace ThemeGraphReferenceRequest {
  export const method = 'themeGraph/references';
  export const type = new rpc.RequestType<Params, Response, void>(method);
  export interface Params {
    uri: string;
    offset?: number;
    includeIndirect?: boolean;
  }
  export type Response = AugmentedReference[];
}

export namespace ThemeGraphDependenciesRequest {
  export const method = 'themeGraph/dependencies';
  export const type = new rpc.RequestType<Params, Response, void>(method);
  export interface Params {
    uri: string;
    offset?: number;
    includeIndirect?: boolean;
  }
  export type Response = AugmentedReference[];
}

export namespace ThemeGraphRootRequest {
  export const method = 'themeGraph/rootUri';
  export const type = new rpc.RequestType<Params, Response, void>(method);
  export interface Params {
    uri: string;
  }
  export type Response = string;
}

export namespace ThemeGraphDidUpdateNotification {
  export const method = 'themeGraph/onDidChangeTree';
  export const type = new rpc.NotificationType<Params>(method);
  export interface Params {
    uri: string;
  }
}

export type AugmentedLocation =
  | {
      uri: string;
      range: undefined;
      excerpt: undefined;
      position: undefined;
    }
  | {
      uri: string;
      range: [number, number];
      excerpt: string;
      position: Range;
    };

export interface AugmentedReference extends Reference {
  source: AugmentedLocation;
  target: AugmentedLocation;
  indirect: boolean;
}
