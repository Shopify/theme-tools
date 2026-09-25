import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema, isSectionSchema } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const SchemaPresetsAndDefault: LiquidCheckDefinition = {
  meta: {
    code: 'SchemaPresetsAndDefault',
    name: 'Prevent sections from defining both presets and default',
    docs: {
      description:
        'Reports section schemas that define both `presets` and `default`, which the platform rejects.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/schema-presets-and-default',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const schema = await getSchema(context);
        if (!isSectionSchema(schema)) return;

        const { validSchema, ast } = schema;
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;
        if (validSchema.presets === undefined || validSchema.default === undefined) return;

        const defaultNode = nodeAtPath(ast, ['default']);
        if (!defaultNode) return;

        const offset = node.blockStartPosition.end;
        context.report({
          message: "Invalid schema: cannot define both 'default' and 'presets'",
          startIndex: offset + getLocStart(defaultNode),
          endIndex: offset + getLocEnd(defaultNode),
        });
      },
    };
  },
};
