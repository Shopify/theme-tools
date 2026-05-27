import { minimatch } from 'minimatch';
import { JSONCheckDefinition, SchemaProp, Severity, SourceCodeType } from '../../types';
import {
  isTerminalTranslationNode,
  isTranslationKeyUsed,
  jsonPath,
} from '../../utils/translation-references';

const schema = {
  ignoreKeys: SchemaProp.array(SchemaProp.string(), ['shopify.*', 'customer_accounts.*']),
};

export const UnusedTranslationKey: JSONCheckDefinition<typeof schema> = {
  meta: {
    code: 'UnusedTranslationKey',
    name: 'Reports unused translation keys',
    docs: {
      description: 'Reports translation keys in default locale files that are not referenced',
      recommended: false,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-translation-key',
    },
    type: SourceCodeType.JSON,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    const isSchemaTranslationFile = relativePath.endsWith('.default.schema.json');
    const isDefaultLocaleFile =
      relativePath.startsWith('locales/') &&
      (relativePath.endsWith('.default.json') || isSchemaTranslationFile);

    if (!isDefaultLocaleFile || context.file.ast instanceof Error) {
      return {};
    }

    function isIgnored(path: string) {
      return context.settings.ignoreKeys.some((pattern) => minimatch(path, pattern));
    }

    return {
      async Property(node, ancestors) {
        if (!isTerminalTranslationNode(node.value)) return;

        const path = jsonPath(ancestors, node);
        if (!path) return;
        if (isIgnored(path)) return;

        const references = await context.getTranslationReferences?.();
        if (!references) return;
        if (!isSchemaTranslationFile && references.hasDynamicReferences) return;

        if (isTranslationKeyUsed(path, references, isSchemaTranslationFile)) return;

        context.report({
          message: `Translation key '${path}' is not statically referenced`,
          startIndex: node.loc!.start.offset,
          endIndex: node.loc!.end.offset,
          suggest: [
            {
              message: 'Delete unused translation key',
              fix(corrector) {
                corrector.remove(path);
              },
            },
          ],
        });
      },
    };
  },
};
