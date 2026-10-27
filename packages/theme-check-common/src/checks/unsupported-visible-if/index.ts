import {
  Severity,
  SourceCodeType,
  type JSONCheckDefinition,
  type LiquidCheckDefinition,
} from '../../types';
import { nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import { reportWarning } from '../../utils';
import {
  isVisibleIfUnsupportedSettingType,
  settingTypeOf,
  unsupportedVisibleIfMessage,
} from '../valid-visible-if/visible-if-utils';

// Like ValidVisibleIf, this exports two checks: one for section and block
// Liquid files, and one for 'config/settings_schema.json'.

const meta = {
  code: 'UnsupportedVisibleIf',
  name: 'Report visible_if on setting types that ignore it',
  docs: {
    description:
      'Warns when visible_if is set on a setting type that does not support conditional visibility. Shopify accepts the file, but ignores visible_if and always shows the setting in the theme editor.',
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unsupported-visible-if',
  },
  severity: Severity.WARNING,
  schema: {},
  targets: [],
};

type SettingLike = { type?: unknown; visible_if?: unknown };

export const UnsupportedVisibleIf: LiquidCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.LiquidHtml },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const offset = node.blockStartPosition.end;

        const reportSettings = (settings: unknown, path: (string | number)[]) => {
          if (!Array.isArray(settings)) return;

          settings.forEach((setting: SettingLike, i) => {
            if (!setting || typeof setting !== 'object' || !('visible_if' in setting)) return;
            if (!isVisibleIfUnsupportedSettingType(setting.type)) return;

            const visibleIfNode = nodeAtPath(ast, [...path, i, 'visible_if']);
            if (!visibleIfNode) return;

            reportWarning(
              unsupportedVisibleIfMessage(setting.type),
              offset,
              visibleIfNode,
              context,
            );
          });
        };

        reportSettings(validSchema.settings, ['settings']);

        // Section files can define local blocks with their own settings.
        const blocks = 'blocks' in validSchema ? validSchema.blocks : undefined;
        if (Array.isArray(blocks)) {
          blocks.forEach((block, j) => {
            if (block && typeof block === 'object' && 'settings' in block) {
              reportSettings(block.settings, ['blocks', j, 'settings']);
            }
          });
        }
      },
    };
  },
};

export const UnsupportedVisibleIfSettingsSchema: JSONCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.JSON },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (relativePath !== 'config/settings_schema.json') return {};

    return {
      async Property(node, ancestors) {
        if (node.key.value !== 'visible_if') return;

        const type = settingTypeOf(ancestors.at(-1));
        if (!isVisibleIfUnsupportedSettingType(type)) return;

        context.report({
          message: unsupportedVisibleIfMessage(type),
          startIndex: node.value.loc.start.offset,
          endIndex: node.value.loc.end.offset,
        });
      },
    };
  },
};
