import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import { LiquidCheckDefinition, LiteralNode, Severity, SourceCodeType } from '../../types';
import { deepGet } from '../../utils';

const MAX_SCHEMA_NAME_LENGTH = 25;

export const ValidSchemaName: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSchemaName',
    name: 'Enforce valid schema name',
    docs: {
      description: 'This check is aimed at ensuring a valid schema name.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema-name',
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
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const name = validSchema.name;
        if (!name) return;

        // We can make this type assertion because we know the schema is valid
        const nameNode = nodeAtPath(ast, ['name'])! as LiteralNode;
        const startIndex = offset + getLocStart(nameNode);
        const endIndex = offset + getLocEnd(nameNode);

        if (name.startsWith('t:')) {
          const defaultLocale = await context.getDefaultLocale();
          const key = name.replace('t:', '');
          const defaultTranslations = await context.getDefaultSchemaTranslations();
          const translation = deepGet(defaultTranslations, key.split('.'));

          if (translation === undefined) {
            context.report({
              message: `'${name}' does not have a matching entry in 'locales/${defaultLocale}.default.schema.json'`,
              startIndex,
              endIndex,
            });
          }

          if (translation !== undefined && translation.length > MAX_SCHEMA_NAME_LENGTH) {
            context.report({
              message: `Schema name '${translation}' from 'locales/${defaultLocale}.default.schema.json' is too long (max 25 characters)`,
              startIndex,
              endIndex,
            });
          }
        } else if (name.length > MAX_SCHEMA_NAME_LENGTH) {
          context.report({
            message: `Schema name '${name}' is too long (max 25 characters)`,
            startIndex,
            endIndex,
          });
        }
      },
    };
  },
};
