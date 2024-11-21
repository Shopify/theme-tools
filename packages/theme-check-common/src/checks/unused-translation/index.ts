import {
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
  Translations,
} from '../../types';
import { parseJSON } from '../../json';
import { isError } from 'lodash-es';

export const UnusedTranslation: LiquidCheckDefinition = {
  meta: {
    code: 'UnusedTranslation',
    name: 'Avoids unused translations',
    docs: {
      description:
        'This check exists to prevent bloat in themes by surfacing translations that are not used.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-translations',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    //State
    const usedTranslationKeys = new Set<string>();
    let allTranslationkeys: Array<{ key: string; startIndex: number; endIndex: number }> = [];
    let translationKeys: Array<{ key: string; startIndex: number; endIndex: number }> = [];
    let defaultTranslations: Translations;
    let defaultSchemaTranslations: Translations;

    function processTranslations(translations: Translations, node: any) {
        // Translations are flat in this case, no need for nested processing
        const entries = Object.entries(translations);
        for (const [key] of entries) {
          translationKeys.push({
            key,
            startIndex: node.position.start,
            endIndex: node.position.end,
          });
        }
        
        if (entries.some(([key]) => key === node.expression.value)) {
          usedTranslationKeys.add(node.expression.value);
        }
      }

    return {
      async onCodePathStart() {
        defaultTranslations = await context.getDefaultTranslations();
        defaultSchemaTranslations = await context.getDefaultSchemaTranslations();
        console.log("Default translations")
        console.log(defaultTranslations)
        console.log("Schema translations")
        console.log(defaultSchemaTranslations)
      },

      async LiquidVariable(node) {
        if (node.expression.type !== 'String') {
          return;
        }

        if (!node.filters.some(({ name }) => ['t', 'translate'].includes(name))) {
          return;
        }

        processTranslations(defaultTranslations, node);
        processTranslations(defaultSchemaTranslations, node);
      },

      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }
        const schema = parseJSON(node.body.value);
        if (isError(schema) && schema instanceof SyntaxError) return;
        processTranslations(defaultTranslations, node.body.value);
        processTranslations(defaultSchemaTranslations, node.body.value);
      },

      async onCodePathEnd() {
        for (const translation of translationKeys) {
            console.log(translationKeys)
          if (!usedTranslationKeys.has(translation.key) && !translation.key.startsWith('_')) {
            context.report({
              message: `The translation key '${translation.key}' is defined but never used`,
              startIndex: translation.startIndex,
              endIndex: translation.endIndex,
            });
          }
        }
      },
    };
  },
};
