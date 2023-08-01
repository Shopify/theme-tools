import {
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
} from '../../types';

type LiquidRawTag = NodeOfType<NodeTypes.LiquidRawTag>;

export const MatchingSchemaTranslations: LiquidCheckDefinition = {
  meta: {
    code: 'MatchingSchemaTranslations',
    name: 'Matching Schema Translations',
    docs: {
      description: 'Validates translations in schema tags (`{% schema %}`).',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const collectedLocalizedKeys: { path: string; locales: string[]; node: LiquidRawTag }[] = [];

    function isLocalizedKey(value: any, defaultLocale: string): value is Record<string, string> {
      return typeof value === 'object' && value !== null && defaultLocale in value;
    }

    function vistKeys(
      objectToVisit: any,
      path: string[],
      defaultLocale: string,
      node: LiquidRawTag,
    ) {
      if (typeof objectToVisit !== 'object' || objectToVisit === null) return;

      if ('id' in objectToVisit) {
        path = [...path, objectToVisit['id']];
      }

      Object.entries(objectToVisit).forEach(([propertyKey, propertyValue]) => {
        const newPath = [...path, propertyKey];

        if (Array.isArray(propertyValue)) {
          propertyValue.forEach((item) => vistKeys(item, newPath, defaultLocale, node));
        } else if (isLocalizedKey(propertyValue, defaultLocale)) {
          collectedLocalizedKeys.push({
            path: newPath.join('.'),
            locales: Object.keys(propertyValue),
            node,
          });
        } else {
          vistKeys(propertyValue, newPath, defaultLocale, node);
        }
      });
    }

    return {
      async LiquidRawTag(node: LiquidRawTag) {
        if (node.name === 'schema') {
          try {
            const defaultLocale = await context.getDefaultLocale();
            const schemaObject = JSON.parse(node.body.value);
            vistKeys(schemaObject, [], defaultLocale, node);
          } catch (error) {
            // Ignore JSON parsing errors
          }
        }
      },

      async onCodePathEnd() {
        const allLocales = collectedLocalizedKeys.flatMap((key) => key.locales);

        collectedLocalizedKeys.forEach((key) => {
          const missingLocales = allLocales.filter((locale) => !key.locales.includes(locale));
          missingLocales.forEach((missingLocale) => {
            context.report({
              message: `${key.path} missing translations for ${missingLocale}`,
              startIndex: key.node.blockStartPosition.start,
              endIndex: key.node.blockStartPosition.end,
            });
          });
        });
      },
    };
  },
};
