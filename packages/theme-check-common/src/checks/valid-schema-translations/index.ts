import { getLocEnd, getLocStart } from '../../json';
import { getSchema } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { deepGet } from '../../utils';
import { JSONNode, LiteralNode } from '../../jsonc/types';

export const ValidSchemaTranslations: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSchemaTranslations',
    name: 'Reports missing translation keys in schema',
    docs: {
      description:
        'This check ensures all translation keys (t:) in schema have matching entries in the default schema translations file.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema-translations',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const offset = node.blockStartPosition.end;
        const schema = await getSchema(context);
        const { ast } = schema ?? {};
        if (!ast || ast instanceof Error) return;

        const defaultLocale = await context.getDefaultLocale();
        const defaultTranslations = await context.getDefaultSchemaTranslations();

        // Find all string values that start with 't:' and check if they have translations
        const translationNodes = findTranslationKeys(ast);

        for (const { value, node: literalNode } of translationNodes) {
          const key = value.replace('t:', '');
          const translation = deepGet(defaultTranslations, key.split('.'));

          if (translation === undefined) {
            const startIndex = offset + getLocStart(literalNode);
            const endIndex = offset + getLocEnd(literalNode);

            context.report({
              message: `'${value}' does not have a matching entry in 'locales/${defaultLocale}.default.schema.json'`,
              startIndex,
              endIndex,
            });
          }
        }
      },
    };
  },
};

/**
 * Recursively find all string literal nodes that start with 't:' (translation keys)
 */
function findTranslationKeys(node: JSONNode): { value: string; node: LiteralNode }[] {
  const results: { value: string; node: LiteralNode }[] = [];

  switch (node.type) {
    case 'Literal': {
      if (typeof node.value === 'string' && node.value.startsWith('t:')) {
        results.push({ value: node.value, node });
      }
      break;
    }

    case 'Object': {
      for (const property of node.children) {
        results.push(...findTranslationKeys(property.value));
      }
      break;
    }

    case 'Array': {
      for (const child of node.children) {
        results.push(...findTranslationKeys(child));
      }
      break;
    }

    case 'Property':
    case 'Identifier': {
      // Keys don't contain translation values
      break;
    }
  }

  return results;
}
