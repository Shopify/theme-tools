import { PropertyNode } from 'json-to-ast';
import {
  JSONCheckDefinition,
  JSONNode,
  JSONSourceCode,
  SchemaProp,
  Severity,
  SourceCodeType,
} from '../../types';

const PLURALIZATION_KEYS = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

const schema = {
  ignore: SchemaProp.array<string>(),
};

export const MatchingTranslations: JSONCheckDefinition<typeof schema> = {
  meta: {
    code: 'MatchingTranslations',
    name: 'Translation files should have the same keys',
    docs: {
      description: 'TODO',
      recommended: true,
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema,
    targets: [],
  },

  create(context) {
    // State
    const defaultTranslations = new Set<string>();
    const missingTranslations = new Set<string>();
    const nodesByPath = new Map<string, PropertyNode>();

    // Helpers
    const hasDefaultTranslations = () => defaultTranslations.size > 0;
    const isTerminalNode = ({ type }: JSONNode) => type === 'Literal';
    const isPluralizationNode = (node: PropertyNode) => PLURALIZATION_KEYS.has(node.key.value);
    const isShopifyPath = (path: string) => path.startsWith('shopify.');

    const hasDefaultTranslation = (translationPath: string) =>
      defaultTranslations.has(translationPath) ?? false;

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

    const countCommonParts = (arrayA: string[], arrayB: string[]): number => {
      const firstMismatch = arrayA.findIndex((part, i) => part !== arrayB[i]);

      if (firstMismatch !== -1) {
        return firstMismatch;
      }

      return Math.min(arrayA.length, arrayB.length);
    };

    const file = context.file;
    const ast = file.ast;
    if (!isLocaleFile(file) || isDefaultTranslationsFile(file) || ast instanceof Error) {
      // No need to lint a file that isn't a translation file, we return an
      // empty object as the check for those.
      return {};
    }

    const closestTranslationKey = (translationKey: string) => {
      const keys = Array.from(nodesByPath.keys());
      const [closestMatch, _commonParts] = keys
        .map((path): [string, number] => {
          const common = countCommonParts(path.split('.'), translationKey.split('.'));
          return [path, common];
        })
        .reduce(
          ([pathA, commonA], [pathB, commonB]) => {
            return commonB > commonA ? [pathB, commonB] : [pathA, commonA];
          },
          ['', 0],
        );

      return nodesByPath.get(closestMatch) ?? ast;
    };

    return {
      async onCodePathStart() {
        const defaultTranslationPaths = await context.getDefaultTranslations().then(jsonPaths);
        defaultTranslationPaths.forEach(Set.prototype.add, defaultTranslations);

        // At the `onCodePathStart`, we assume that all translations are missing,
        // and remove translation paths while traversing through the file.
        defaultTranslationPaths.forEach(Set.prototype.add, missingTranslations);
      },

      async Property(node, ancestors) {
        const path = objectPath(ancestors.concat(node));

        nodesByPath.set(path, node);

        if (!hasDefaultTranslations()) return;
        if (isPluralizationNode(node)) return;
        if (!isTerminalNode(node.value)) return;
        if (isShopifyPath(path)) return;

        if (hasDefaultTranslation(path)) {
          // As `path` is present, we remove it from the
          // `missingTranslationsPerFile` bucket.
          missingTranslations.delete(path);
          return;
        }

        context.report({
          message: `A default translation for '${path}' does not exist`,
          startIndex: node.loc!.start.offset,
          endIndex: node.loc!.end.offset,
          suggest: [
            {
              message: 'Delete unneeded translation key',
              fix(corrector) {
                corrector.remove(path);
              },
            },
          ],
        });
      },

      async onCodePathEnd() {
        missingTranslations.forEach((path) => {
          const closest = closestTranslationKey(path);

          if (isPluralizationPath(path)) return;
          if (isShopifyPath(path)) return;

          context.report({
            message: `The translation for '${path}' is missing`,
            startIndex: closest.loc!.start.offset,
            endIndex: closest.loc!.end.offset,
            fix(corrector) {
              corrector.add(path, 'TODO');
            },
          });
        });
      },
    };
  },
};
