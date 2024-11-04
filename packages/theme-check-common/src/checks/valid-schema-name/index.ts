import { parseJSON } from '../../json';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isError } from '../../utils';

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

        const schema = parseJSON(node.body.value);
        if (isError(schema) && schema instanceof SyntaxError) return;

        if (!schema.name.startsWith('t:') && schema.name.length > MAX_SCHEMA_NAME_LENGTH) {
          context.report({
            message: 'Schema name is too long (max 25 characters)',
            startIndex: node.blockStartPosition.end, //awaiting schema AST to have attribute positions
            endIndex: node.blockEndPosition.start,
          });
        }
      },
    };
  },
};
