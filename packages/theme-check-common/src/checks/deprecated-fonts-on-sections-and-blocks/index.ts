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
  ArrayNode,
} from '../../types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { DEPRECATED_FONT_HANDLES } from './deprecated-fonts-data';

export const DeprecatedFontsOnSectionsAndBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecatedFontsOnSectionsAndBlocks',
    name: 'Check for deprecated fonts in section and block schema settings values',
    docs: {
      description: 'Warns on deprecated fonts in section and block schema settings values.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-fonts-on-sections-and-blocks',
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

        // 2nd: check local blocks settings for deprecated fonts
        checkLocalBlocksSettingsForDeprecatedFonts(validSchema, offset, ast, context);

        // 3rd: check preset settings for deprecated fonts
        await checkPresetsForDeprecatedFonts(validSchema, offset, ast, context);

        // 4th: check schema default (sections only) for deprecated fonts
        if ('default' in validSchema) {
          await checkSchemaDefaultForDeprecatedFonts(
            validSchema as Section.Schema,
            offset,
            ast,
            context,
          );
        }
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

  checkSettingsForDeprecatedFonts(settings, offset, ast, ['settings'], context);
}

function checkSettingsForDeprecatedFonts(
  settings: Setting.Any[],
  offset: number,
  ast: JSONNode,
  warningAstPath: string[],
  context: Context<SourceCodeType.LiquidHtml>,
) {
  settings.forEach((setting, index) => {
    if (
      setting.type === 'font_picker' &&
      setting.default &&
      DEPRECATED_FONT_HANDLES.has(setting.default)
    ) {
      const currentPath = warningAstPath.concat([String(index), 'default']);
      reportWarning(
        context,
        offset,
        ast as JSONNode,
        currentPath,
        `setting '${setting.id}' is using deprecated font '${setting.default}'`,
      );
    }
  });
}

function checkLocalBlocksSettingsForDeprecatedFonts(
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  const blocks = schema.blocks;
  if (!blocks) return;

  blocks.forEach((block, index) => {
    if ('settings' in block && block.settings) {
      checkSettingsForDeprecatedFonts(
        block.settings as Setting.Any[],
        offset,
        ast,
        ['blocks', String(index), 'settings'],
        context,
      );
    }
  });
}

async function checkPresetsForDeprecatedFonts(
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  const presets = schema.presets;
  if (!presets) return;

  for (const [preset_index, preset] of presets.entries()) {
    const warningAstPath = ['presets', String(preset_index)];
    await checkSettingsAndBlocksForDeprecatedFonts(
      preset.settings ?? {},
      'blocks' in preset ? preset.blocks : undefined,
      schema,
      offset,
      ast,
      warningAstPath,
      context,
    );
  }
}

async function checkSettingsAndBlocksForDeprecatedFonts(
  settings: Setting.Values,
  blocks:
    | Preset.PresetBlockHash
    | Preset.PresetBlockForArray[]
    | Section.DefaultBlock[]
    | undefined,
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  warningAstPath: string[],
  context: Context<SourceCodeType.LiquidHtml>,
) {
  // check settings for deprecated fonts
  if (settings && typeof settings === 'object') {
    Object.entries(settings).forEach(([settingKey, settingValue]) => {
      if (
        isFontPickerType(schema.settings ?? [], settingKey) &&
        DEPRECATED_FONT_HANDLES.has(settingValue as string)
      ) {
        const currentPath = warningAstPath.concat(['settings', settingKey]);
        reportWarning(
          context,
          offset,
          ast,
          currentPath,
          `setting '${settingKey}' is using deprecated font '${settingValue}'`,
        );
      }
    });
  }

  // check blocks for deprecated fonts
  if (blocks) {
    await checkBlocksForDeprecatedFonts(blocks, schema, offset, ast, context, warningAstPath);
  }
}

async function checkBlocksForDeprecatedFonts(
  blocks: Preset.PresetBlockHash | Preset.PresetBlockForArray[] | Section.DefaultBlock[],
  schema: ThemeBlock.Schema | Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
  nodePath: string[],
) {
  const iterator = Array.isArray(blocks) ? blocks.entries() : Object.entries(blocks!);

  for (const [keyOrIndex, block] of iterator) {
    const currentPath = nodePath.concat(['blocks', String(keyOrIndex)]);

    // we'll need the schema to verify that the setting is a font_picker type
    // local blocks don't have a schema coming from the another theme file, we need to get it from the schema of the section
    // look in the schema blocks for the block type, if this block has a name, it's a local block, otherwise, it's a theme block
    let validSchema = null;

    schema.blocks?.forEach((schemaBlock) => {
      if (schemaBlock.type === block.type && 'name' in schemaBlock) {
        validSchema = schemaBlock;
      }
    });

    if (!validSchema) {
      const blockSchema = await context.getBlockSchema?.(block.type);
      if (!blockSchema || blockSchema instanceof Error) continue;
      validSchema = blockSchema.validSchema;
      if (!validSchema || validSchema instanceof Error) continue;
    }

    // block_value is the hash which can have settings, blocks, etc.
    for (const [settingKey, settingValue] of Object.entries(block.settings ?? {})) {
      if (settingValue && DEPRECATED_FONT_HANDLES.has(settingValue as string)) {
        // Check if the setting is a font_picker
        const isFontPickerSetting = isFontPickerType(validSchema.settings ?? [], settingKey);
        if (isFontPickerSetting) {
          reportWarning(
            context,
            offset,
            ast,
            currentPath.concat(['settings', settingKey]),
            `setting '${settingKey}' is using deprecated font '${settingValue}'`,
          );
        }
      }
    }

    if ('blocks' in block && block.blocks) {
      await checkBlocksForDeprecatedFonts(block.blocks, schema, offset, ast, context, currentPath);
    }
  }
}

async function checkSchemaDefaultForDeprecatedFonts(
  schema: Section.Schema,
  offset: number,
  ast: JSONNode,
  context: Context<SourceCodeType.LiquidHtml>,
) {
  const defaultValues = schema.default;
  if (!defaultValues || typeof defaultValues !== 'object') return;

  const warningAstPath = ['default'];
  await checkSettingsAndBlocksForDeprecatedFonts(
    defaultValues.settings ?? {},
    'blocks' in defaultValues ? defaultValues.blocks : undefined,
    schema,
    offset,
    ast,
    warningAstPath,
    context,
  );
}

function isFontPickerType(settings: Setting.Any[], settingKey: string) {
  return settings.some((setting) => setting.id === settingKey && setting.type === 'font_picker');
}

function reportWarning(
  context: Context<SourceCodeType.LiquidHtml>,
  offset: number,
  ast: JSONNode,
  ast_path: string[],
  message: string,
  fullHighlight: boolean = true,
) {
  const node = nodeAtPath(ast, ast_path)! as ArrayNode;
  const startIndex = fullHighlight ? offset + getLocStart(node) : offset + getLocEnd(node) - 1; // start to finish of the node or last char of the node
  const endIndex = offset + getLocEnd(node);
  context.report({
    message: message,
    startIndex,
    endIndex,
  });
}
