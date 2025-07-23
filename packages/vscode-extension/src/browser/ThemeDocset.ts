import { memo } from '@shopify/theme-check-common';
import { Dependencies } from '@shopify/theme-language-server-browser';
import { Connection } from 'vscode-languageserver/browser';

/**
 * These are replaced at build time by the contents of
 * @shopify/theme-check-docs-updater's DocsManager
 */
declare global {
  export const WEBPACK_TAGS: any[];
  export const WEBPACK_FILTERS: any[];
  export const WEBPACK_OBJECTS: any[];
  export const WEBPACK_SYSTEM_TRANSLATIONS: any;
  export const WEBPACK_SCHEMAS: any;
}

const tags = WEBPACK_TAGS;
const filters = WEBPACK_FILTERS;
const objects = WEBPACK_OBJECTS;
const systemTranslations = WEBPACK_SYSTEM_TRANSLATIONS;
const schemas = WEBPACK_SCHEMAS;

type ThemeDocset = Dependencies['themeDocset'];
type JsonValidationSet = Dependencies['jsonValidationSet'];

const fetchDeps = memo(async () => {
  return fetch('https://vs-code-for-web.shop.dev/deps.json').then((response) => {
    if (!response.ok) {
      console.error(response);
      throw new Error(`Failed to fetch dependencies: ${response.statusText}`);
    }
    return response.json();
  });
});

export class ThemeDocsetManager implements ThemeDocset, JsonValidationSet {
  constructor(private connection: Connection) {}

  // Liquid documentation
  filters = memo(async () => this.fetchUpdatedData('filters', filters));
  tags = memo(async () => this.fetchUpdatedData('tags', tags));
  objects = memo(async () => this.fetchUpdatedData('objects', objects));
  liquidDrops = memo(async () => this.fetchUpdatedData('objects', objects));

  // prettier-ignore
  systemTranslations = memo(async () => this.fetchUpdatedData('systemTranslations', systemTranslations));

  // JSON validation data
  schemas = memo(async () => this.fetchUpdatedData('schemas', schemas));

  fetchUpdatedData = async <T>(
    dependency: 'filters' | 'tags' | 'objects' | 'systemTranslations' | 'schemas',
    fallback: T,
  ): Promise<T> => {
    return fetchDeps()
      .then((deps) => deps[dependency] ?? fallback)
      .then((data) => {
        console.error(`data received! ${dependency}`, data);
        return data as T;
      })
      .catch(() => fallback);
  };
}
