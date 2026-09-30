import { BLOCK_CONTENT_PARAMETER } from '../../block-parameters';
import { nodeAtPath } from '../../json';
import * as path from '../../path';
import { schemaSettingLiquidType } from '../../schema-settings';
import { isBlock } from '../../to-schema';
import {
  Severity,
  SourceCodeType,
  type Context,
  type LiquidCheckDefinition,
  type ThemeBlockSchema,
} from '../../types';
import { reportWarning } from '../../utils';

export const ValidBlockContentSettingType: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockContentSettingType',
    name: 'Valid Block Content Setting Type',
    docs: {
      description:
        "Reports a theme block schema setting named 'content' whose Liquid type is not the built-in 'content' parameter's 'string' type.",
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-content-setting-type',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!isBlock(context.file.uri)) return {};

    const blockName = path.basename(context.file.uri, '.liquid');

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;
        if (!context.getBlockSchema) return;

        reportContentSettingTypeMismatch(context, await context.getBlockSchema(blockName));
      },
    };
  },
};

function reportContentSettingTypeMismatch(
  context: Context<SourceCodeType.LiquidHtml>,
  schema: ThemeBlockSchema | undefined,
): void {
  if (!schema || schema.validSchema instanceof Error || schema.ast instanceof Error) return;

  const settings = schema.validSchema.settings ?? [];
  const index = settings.findIndex((setting) => setting.id === BLOCK_CONTENT_PARAMETER);
  if (index < 0) return;

  const settingType = schemaSettingLiquidType(settings[index].type);
  const typeNode = nodeAtPath(schema.ast, ['settings', index, 'type']);
  if (!settingType || settingType === 'string' || !typeNode) return;

  reportWarning(
    `Schema setting 'content' has Liquid type '${settingType}', but the built-in 'content' parameter has type 'string'.`,
    schema.offset,
    typeNode,
    context,
  );
}
