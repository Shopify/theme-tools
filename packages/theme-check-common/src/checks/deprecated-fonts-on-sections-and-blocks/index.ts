import { getSchema } from '../../to-schema';
import {
  JSONNode,
  LiquidCheckDefinition,
  Section,
  Severity,
  Setting,
  Preset,
  SourceCodeType,
  ThemeBlock,
  Context,
  ObjectNode,
} from '../../types';
import { nodeAtPath } from '../../json';
import { reportWarning } from '../../utils/highlighting';
import { DEPRECATED_FONT_HANDLES } from './deprecated-fonts-data';

export const DeprecatedFontsOnSectionsAndBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecatedFontsOnSectionsAndBlocks',
    name: 'Check for deprecated fonts in section and block schema settings values',
    docs: {
      description: 'Warns on deprecated fonts in section and block schema settings values.',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/deprecated-fonts-on-sections-and-blocks',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const offset = node.blockStartPosition.end;

        // 1st: check schema settings for deprecated fonts
        checkSchemaSettingsForDeprecatedFonts(validSchema, offset, ast, context);

        // 2nd: check preset settings for deprecated fonts
        checkPresetSettingsForDeprecatedFonts(validSchema, offset, ast, context);

        // 3rd: check preset blocks' settings for deprecated fonts, including nested blocks
        await checkPresetBlocksForDeprecatedFonts(validSchema, offset, ast, context);
      },
    };
  },
};

function checkSchemaSettingsForDeprecatedFonts(
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  const settings = schema.settings;
  if (!settings) return;

  settings.forEach((setting, index) => {
    if (
      setting.type === 'font_picker' &&
      setting.default &&
      DEPRECATED_FONT_HANDLES.has(setting.default)
    ) {
      const warning_ast_path = ['settings', String(index), 'default'];
      reportWarning(
        context,
        offset,
        ast as JSONNode,
        warning_ast_path,
        `setting '${setting.id}' is using deprecated font '${setting.default}' for default value`,
      );
    }
  });
}

function checkPresetSettingsForDeprecatedFonts(
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  const presets = schema.presets;
  if (!presets) return;

  presets.forEach((preset, preset_index) => {
    if (!preset.settings || typeof preset.settings !== 'object') return;

    Object.entries(preset.settings).forEach(([setting_key, setting_value]) => {
      if (
        isFontPickerType(schema.settings ?? [], setting_key) &&
        DEPRECATED_FONT_HANDLES.has(setting_value as string)
      ) {
        const warning_ast_path = ['presets', String(preset_index), 'settings', setting_key];
        reportWarning(
          context,
          offset,
          ast,
          warning_ast_path,
          `setting '${setting_key}' is using deprecated font '${setting_value}' for default value`,
        );
      }
    });
  });
}

async function checkPresetBlocksForDeprecatedFonts(
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  const presets = schema.presets;
  if (!presets) return;

  for (const [preset_index, preset] of presets.entries()) {
    if (!('blocks' in preset) || !preset.blocks) continue;

    await checkBlocksForDeprecatedFonts(preset.blocks, schema, offset, ast, context, preset, [
      'presets',
      String(preset_index),
    ]);
  }
}

async function checkBlocksForDeprecatedFonts(
  blocks: Preset.PresetBlockHash | Preset.PresetBlockForArray[],
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
  preset: Preset.Preset,
  nodePath: string[],
) {
  const iterator = Array.isArray(blocks) ? blocks.entries() : Object.entries(blocks!);

  for (const [keyOrIndex, block] of iterator) {
    nodePath = nodePath.concat(['blocks', String(keyOrIndex)]);
    const node = nodeAtPath(ast, nodePath)! as ObjectNode;

    let blockSchema = null; // This is used to avoid reading the schema multiple times.

    // block_value is the hash which can have settings, blocks, etc.
    for (const [setting_key, setting_value] of Object.entries(block.settings ?? {})) {
      if (setting_value && DEPRECATED_FONT_HANDLES.has(setting_value as string)) {
        // We found a setting value that is a deprecated font, we need to get the block schema to check the setting type is a font_picker.
        if (!blockSchema) {
          blockSchema = await context.getBlockSchema?.(block.type);
          if (!blockSchema || blockSchema instanceof Error) continue;
        }

        const { validSchema } = blockSchema;
        if (!validSchema || validSchema instanceof Error) continue;

        // Check if the setting is a font_picker
        const isFontPickerSetting = isFontPickerType(validSchema.settings ?? [], setting_key);

        if (isFontPickerSetting) {
          reportWarning(
            context,
            offset,
            ast,
            nodePath.concat(['settings', setting_key]),
            `setting '${setting_key}' is using deprecated font '${setting_value}'`,
          );
        }

        if (block.blocks) {
          await checkBlocksForDeprecatedFonts(
            block.blocks,
            schema,
            offset,
            ast,
            context,
            preset,
            nodePath,
          );
        }
      }
    }
  }
}

function isFontPickerType(settings: Setting.Any[], setting_key: string) {
  return settings.some((setting) => setting.id === setting_key && setting.type === 'font_picker');
}

function isPresetBlockHash(
  blocks: Preset.PresetBlockHash | Preset.PresetBlockForArray[],
): blocks is Preset.PresetBlockHash {
  return typeof blocks === 'object' && blocks !== null && !Array.isArray(blocks);
}
