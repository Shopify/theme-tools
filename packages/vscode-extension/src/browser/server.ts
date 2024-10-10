import { recommendedChecks, startServer } from '@shopify/theme-language-server-browser';

console.log('running server lsp-web-extension-sample');

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

console.log(self);

// startServer(self as any as Worker, {
//   findRootURI: async (_: string) => 'file:///dawn',
//   fs: new MockFileSystem(),
//   fileSize: async () => 10,
//   getDefaultTranslationsFactory: () => async () => ({}),
//   getDefaultLocaleFactory: () => async () => 'en',
//   getDefaultSchemaTranslationsFactory: () => async () => ({}),
//   getDefaultSchemaLocaleFactory: () => async () => 'en',
//   getThemeSettingsSchemaForRootURI: async () => [],
//   loadConfig: async () => ({
//     context: 'theme',
//     settings: {},
//     checks: recommendedChecks,
//     rootUri: 'file:///dawn',
//   }),
//   log: console.info.bind(console),
//   themeDocset: {
//     filters: async () => filters,
//     objects: async () => objects,
//     tags: async () => tags,
//     systemTranslations: async () => systemTranslations,
//   },
//   jsonValidationSet: {
//     schemas: async () => schemas,
//   },
// });
