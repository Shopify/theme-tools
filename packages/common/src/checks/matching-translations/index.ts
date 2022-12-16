import {
  JSONCheckDefinition,
  JSONNode,
  JSONSourceCode,
  Severity,
  SourceCodeType,
} from '@shopify/theme-check-common';
import { LiteralNode, ObjectNode, PropertyNode } from 'json-to-ast';

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
    const translationsPerFile = new Map<JSONSourceCode, Map<string, PropertyNode>>();
    const isLocaleFile = (file: JSONSourceCode) =>
      file.relativePath.startsWith('locales/') && !file.relativePath.endsWith('schema.json');
    const isTerminalNode = (node: JSONNode): node is LiteralNode => node.type === 'Literal';
    const isObjectNode = (node: JSONNode): node is ObjectNode => node.type === 'Object';
    const isPlurarizationNode = (node: PropertyNode) => PLURALIZATION_KEYS.has(node.key.value);
    const isPlurarizationParent = (node: PropertyNode) =>
      isObjectNode(node.value) && !!node.value.children.find(isPlurarizationNode);

    const objectPath = (nodes: JSONNode[]) => {
      return nodes
        .filter((node): node is PropertyNode => node.type === 'Property')
        .reduce((acc: string[], val) => acc.concat(val.key.value), [])
        .join('.');
    };

    return {
      async onCodePathStart(file) {
        if (!isLocaleFile(file)) return;
        translationsPerFile.set(file, new Map());
      },

      async Property(node, file, ancestors) {
        if (!isLocaleFile(file)) return;
        if (isPlurarizationNode(node)) return;
        if (isTerminalNode(node.value) || isPlurarizationParent(node)) {
          translationsPerFile.get(file)!.set(objectPath(ancestors.concat(node)), node);
        }
      },

      async onEnd() {
        const files = [...translationsPerFile.keys()];
        const defaultTranslationsFile =
          files.find((x) => x.relativePath.endsWith('.default.json')) ||
          files.find((x) => x.relativePath === 'locales/en.json');
        if (!defaultTranslationsFile) return;

        const defaultTranslations = translationsPerFile.get(defaultTranslationsFile);
        if (!defaultTranslations) return;

        for (const [file, translations] of translationsPerFile.entries()) {
          if (file === defaultTranslationsFile) continue;

          const missingInDefault = [...translations.keys()].filter(
            (path) => !defaultTranslations.has(path),
          );

          for (const path of missingInDefault) {
            const node = translations.get(path);
            context.report(file, {
              message: `A default translation for '${path}' does not exist`,
              startIndex: node!.loc!.start.offset,
              endIndex: node!.loc!.end.offset,
            });
          }

          const missingInOther = [...defaultTranslations.keys()].filter(
            (path) => !translations.has(path),
          );

          for (const path of missingInOther) {
            const commonAncestor = file.ast; // TODO, should be smarter than this
            context.report(file, {
              message: `Default translation '${path}' is missing`,
              startIndex: commonAncestor.loc!.start.offset,
              endIndex: commonAncestor.loc!.end.offset,
            });
          }
        }
      },
    };
  },
};
