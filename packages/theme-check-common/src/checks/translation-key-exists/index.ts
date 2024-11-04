import { parseJSON } from '../../json';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isError } from '../../utils';

function keyExists(key: string, pointer: any) {
  for (const token of key.split('.')) {
    if (typeof pointer !== 'object') {
      return false;
    }

    if (!pointer.hasOwnProperty(token)) {
      return false;
    }

    pointer = pointer[token];
  }

  return true;
}

export const TranslationKeyExists: LiquidCheckDefinition = {
  meta: {
    code: 'TranslationKeyExists',
    name: 'Reports missing translation keys',
    docs: {
      description: 'Reports missing translation keys',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/translation-key-exists',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const nodes: { translationKey: string; startIndex: number; endIndex: number }[] = [];
    let schemaLocales: any;

    return {
      async LiquidVariable(node) {
        if (node.expression.type !== 'String') {
          return;
        }

        if (!node.filters.some(({ name }) => ['t', 'translate'].includes(name))) {
          return;
        }

        nodes.push({
          translationKey: node.expression.value,
          startIndex: node.expression.position.start,
          endIndex: node.expression.position.end,
        });
      },

      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const defaultLocale = await context.getDefaultLocale();
        const schema = parseJSON(node.body.value);
        if (isError(schema) && schema instanceof SyntaxError) return;
        schemaLocales = schema.locales?.[defaultLocale];
      },

      async onCodePathEnd() {
        const defaultTranslations = await context.getDefaultTranslations();
        const defaultLocale = await context.getDefaultLocale();
        const systemTranslations = await context.themeDocset?.systemTranslations();
        const systemTranslationsKeys = Object.keys(systemTranslations ?? {});

        if (!defaultTranslations && systemTranslationsKeys.length === 0) return;

        nodes.forEach(({ translationKey, startIndex, endIndex }) => {
          if (
            keyExists(translationKey, defaultTranslations) ||
            keyExists(translationKey, schemaLocales) ||
            systemTranslationsKeys.includes(translationKey)
          ) {
            return;
          }

          let message = `'${translationKey}' does not have a matching entry in 'locales/${defaultLocale}.default.json'`;
          if (schemaLocales) {
            message += ` or '${context.toRelativePath(context.file.uri)}'`;
          }

          context.report({
            message,
            startIndex,
            endIndex,
          });
        });
      },
    };
  },
};
