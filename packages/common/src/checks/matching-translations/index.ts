import {
  JSONCheckDefinition,
  JSONNode,
  JSONSourceCode,
  Severity,
  SourceCodeType,
} from '@shopify/theme-check-common';
import { PropertyNode } from 'json-to-ast';

const PLURALIZATION_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

export const MatchingTranslations: JSONCheckDefinition = {
  meta: {
    code: 'MatchingTranslations',
    name: 'Translation files should have the same keys',
    docs: {
      description: 'TODO',
      recommended: true,
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    // --- State

    const missingTranslationsPerFile = new Map<JSONSourceCode, Set<string>>();

    let defaultTranslations: Set<string> | undefined;

    // --- Helpers

    const hasDefaultTranslations = () => defaultTranslations?.size ?? 0 > 0;

    const isTerminalNode = ({ type }: JSONNode) => type === 'Literal';

    const isPluralizationNode = (node: PropertyNode) => PLURALIZATION_KEYS.has(node.key.value);

    const isShopifyPath = (path: string) => path.startsWith('shopify.');

    const hasDefaultTranslation = (translationPath: string) =>
      defaultTranslations?.has(translationPath) ?? false;

    const isDefaultTranslationsFile = ({ absolutePath }: JSONSourceCode) =>
      absolutePath.endsWith('.default.json');

    const isPluralizationPath = (path: string) =>
      [...PLURALIZATION_KEYS].some((key) => path.endsWith(key));

    const isLocaleFile = ({ absolutePath }: JSONSourceCode) => {
      const relativePath = context.relativePath(absolutePath);

      return relativePath.startsWith('locales/') && !relativePath.endsWith('schema.json');
    };

    const jsonPaths = (json: any): string[] => {
      const keys = Object.keys(json);

      return keys.reduce((acc: string[], key: string) => {
        if (typeof json[key] !== 'object') {
          return acc.concat(key);
        }

        const childJson = json[key];
        const childPaths = jsonPaths(childJson);

        return acc.concat(childPaths.map((path) => `${key}.${path}`));
      }, []);
    };

    const objectPath = (nodes: JSONNode[]) => {
      return nodes
        .filter((node): node is PropertyNode => node.type === 'Property')
        .reduce((acc: string[], val) => acc.concat(val.key.value), [])
        .join('.');
    };

    // --- Core

    return {
      async onCodePathStart(file) {
        if (!isLocaleFile(file)) return;
        if (isDefaultTranslationsFile(file)) return;

        defaultTranslations ??= new Set<string>(jsonPaths(await context.getDefaultTranslations()));

        // At the `onCodePathStart`, we assume that all translations are missing,
        // and remove translation paths while traversing through the file.
        const missingTranslation = new Set<string>(defaultTranslations);

        missingTranslationsPerFile.set(file, missingTranslation);
      },

      async onCodePathEnd(file) {
        if (!isLocaleFile(file)) return;
        if (isDefaultTranslationsFile(file)) return;

        missingTranslationsPerFile.get(file)?.forEach((path) => {
          if (isPluralizationPath(path)) return;
          if (isShopifyPath(path)) return;

          context.report(file, {
            message: `The translation for '${path}' is missing`,
            startIndex: file.ast.loc!.start.offset,
            endIndex: file.ast.loc!.end.offset,
          });
        });
      },

      async Property(node, file, ancestors) {
        if (!hasDefaultTranslations()) return;

        if (isDefaultTranslationsFile(file)) return;
        if (!isLocaleFile(file)) return;

        if (isPluralizationNode(node)) return;
        if (!isTerminalNode(node.value)) return;

        const path = objectPath(ancestors.concat(node));

        if (isShopifyPath(path)) return;

        if (hasDefaultTranslation(path)) {
          // As `path` is present, we remove it from the
          // `missingTranslationsPerFile` bucket.
          missingTranslationsPerFile.get(file)?.delete(path);
          return;
        }

        context.report(file, {
          message: `A default translation for '${path}' does not exist`,
          startIndex: node.loc!.start.offset,
          endIndex: node.loc!.end.offset,
        });
      },
    };
  },
};
