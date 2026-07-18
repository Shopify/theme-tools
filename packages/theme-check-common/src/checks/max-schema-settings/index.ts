import { getSchema, isBlock, isSection } from '../../to-schema';
import { LiquidCheckDefinition, SchemaProp, Severity, Setting, SourceCodeType } from '../../types';

const schema = {
  max: SchemaProp.number(20),
};

const DISPLAY_ONLY_TYPES = new Set<Setting.Type>(['header', 'paragraph'] as Setting.Type[]);

export const MaxSchemaSettings: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'MaxSchemaSettings',
    name: 'Max Schema Settings',
    docs: {
      description:
        'Enforce a maximum number of settings in a schema block to keep sections and blocks focused.',
      recommended: false,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    if (!isSection(context.file.uri) && !isBlock(context.file.uri)) {
      return {};
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const schemaData = await getSchema(context);
        if (!schemaData) return;

        const { validSchema } = schemaData;
        if (!validSchema || validSchema instanceof Error) return;

        const { max } = context.settings;
        const settings = validSchema.settings ?? [];
        const countableSettings = settings.filter((s) => !DISPLAY_ONLY_TYPES.has(s.type));

        if (countableSettings.length <= max) return;

        context.report({
          message: `Schema has too many settings (${countableSettings.length}). Maximum allowed is ${max}.`,
          startIndex: node.blockStartPosition.start,
          endIndex: node.blockStartPosition.end,
        });
      },
    };
  },
};
