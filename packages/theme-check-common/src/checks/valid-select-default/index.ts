import {
  JSONCheckDefinition,
  JSONNode,
  LiquidCheckDefinition,
  Setting,
  Severity,
  SourceCodeType,
  isArrayNode,
  isLiteralNode,
  isObjectNode,
} from '../../types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema, isSectionSchema } from '../../to-schema';

// Note: like ValidVisibleIf, this exports two checks: one for Liquid files
// ({% schema %} in sections/blocks) and one for 'config/settings_schema.json'.
// They perform the same check using the same logic (modulo differences in
// how the schema is extracted and how warning locations are determined).

// Setting is a `declare namespace`, so Setting.Type has no runtime value.
const CHOICE_SETTING_TYPES = new Set<string>(['select', 'radio']);

const meta = {
  code: 'ValidSelectDefault',
  name: 'Validate default values and preset values for select/radio settings',
  docs: {
    description:
      "Warns when a select/radio setting's default value (or a preset's setting value) is not one of the setting's declared options.",
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-select-default',
  },
  severity: Severity.WARNING,
  schema: {},
  targets: [],
};

type ChoiceSetting = {
  id: string;
  type: string;
  options: Array<{ value: unknown }>;
  default?: unknown;
};

function getChoiceSettings(settings: readonly Setting.Any[] | undefined): ChoiceSetting[] {
  if (!settings) return [];
  const result: ChoiceSetting[] = [];
  for (const setting of settings) {
    if (!setting || typeof setting !== 'object') continue;
    if (!('type' in setting) || !CHOICE_SETTING_TYPES.has(setting.type as string)) continue;
    if (!('id' in setting) || typeof setting.id !== 'string') continue;
    const options = (setting as { options?: unknown }).options;
    if (!Array.isArray(options)) continue;
    result.push(setting as unknown as ChoiceSetting);
  }
  return result;
}

function getAllowedValues(setting: ChoiceSetting): string[] {
  const values: string[] = [];
  for (const option of setting.options) {
    if (option && typeof option === 'object' && 'value' in option) {
      const value = (option as { value: unknown }).value;
      if (typeof value === 'string') values.push(value);
      else if (typeof value === 'number' || typeof value === 'boolean') values.push(String(value));
    }
  }
  return values;
}

function invalidDefaultMessage(setting: ChoiceSetting, actual: unknown): string {
  const allowed = getAllowedValues(setting)
    .map((v) => `"${v}"`)
    .join(', ');
  return `Default value ${JSON.stringify(actual)} for setting "${setting.id}" is not one of the valid options: ${allowed}.`;
}

function invalidPresetMessage(setting: ChoiceSetting, actual: unknown): string {
  const allowed = getAllowedValues(setting)
    .map((v) => `"${v}"`)
    .join(', ');
  return `Value ${JSON.stringify(actual)} for setting "${setting.id}" is not one of the valid options: ${allowed}.`;
}

function isValidChoiceValue(setting: ChoiceSetting, value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return true; // leave non-scalar mismatches to JSON schema validation
  }
  const allowed = getAllowedValues(setting);
  return allowed.includes(String(value));
}

export const ValidSelectDefault: LiquidCheckDefinition = {
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
        const choiceSettings = getChoiceSettings(validSchema.settings);
        if (choiceSettings.length === 0) return;

        const settingsById = new Map(choiceSettings.map((s) => [s.id, s]));

        // 1. Validate setting defaults
        for (let i = 0; i < (validSchema.settings?.length ?? 0); i++) {
          const setting = validSchema.settings![i];
          if (!setting || !('id' in setting)) continue;
          const choice = settingsById.get(setting.id as string);
          if (!choice) continue;
          if (!('default' in choice) || choice.default === undefined) continue;

          if (!isValidChoiceValue(choice, choice.default)) {
            const defaultNode = nodeAtPath(ast, ['settings', i, 'default']);
            if (defaultNode) {
              reportAtNode(context, offset, defaultNode, invalidDefaultMessage(choice, choice.default));
            }
          }
        }

        // 2. Validate presets[].settings values
        if (Array.isArray(validSchema.presets)) {
          for (let i = 0; i < validSchema.presets.length; i++) {
            validatePresetSettings(
              context,
              offset,
              ast,
              ['presets', String(i), 'settings'],
              (validSchema.presets[i] as { settings?: Record<string, unknown> }).settings,
              settingsById,
            );
          }
        }

        // 3. Validate section default.settings values
        if (isSectionSchema(schema) && 'default' in validSchema && validSchema.default?.settings) {
          validatePresetSettings(
            context,
            offset,
            ast,
            ['default', 'settings'],
            validSchema.default.settings as Record<string, unknown>,
            settingsById,
          );
        }
      },
    };
  },
};

function validatePresetSettings(
  context: Parameters<LiquidCheckDefinition['create']>[0],
  offset: number,
  ast: JSONNode,
  settingsPath: string[],
  settings: Record<string, unknown> | undefined,
  settingsById: Map<string, ChoiceSetting>,
) {
  if (!settings) return;
  const settingsNode = nodeAtPath(ast, settingsPath);
  if (!settingsNode || !isObjectNode(settingsNode)) return;

  for (const property of settingsNode.children) {
    const key = property.key.value;
    if (typeof key !== 'string') continue;
    const choice = settingsById.get(key);
    if (!choice) continue;

    const valueNode = property.value;
    if (!isLiteralNode(valueNode)) continue;

    if (!isValidChoiceValue(choice, valueNode.value)) {
      reportAtNode(context, offset, valueNode, invalidPresetMessage(choice, valueNode.value));
    }
  }
}

function reportAtNode(
  context: Parameters<LiquidCheckDefinition['create']>[0],
  offset: number,
  astNode: JSONNode,
  message: string,
) {
  context.report({
    message,
    startIndex: offset + getLocStart(astNode),
    endIndex: offset + getLocEnd(astNode),
  });
}

export const ValidSelectDefaultSettingsSchema: JSONCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.JSON },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (relativePath !== 'config/settings_schema.json') return {};

    return {
      async Property(node) {
        if (node.key.value !== 'settings' || !isArrayNode(node.value)) return;

        for (const settingNode of node.value.children) {
          if (!isObjectNode(settingNode)) continue;

          const typeProp = settingNode.children.find((p) => p.key.value === 'type');
          if (!typeProp || !isLiteralNode(typeProp.value)) continue;
          const typeValue = typeProp.value.value;
          if (typeof typeValue !== 'string' || !CHOICE_SETTING_TYPES.has(typeValue)) continue;

          const idProp = settingNode.children.find((p) => p.key.value === 'id');
          const idValue =
            idProp && isLiteralNode(idProp.value) && typeof idProp.value.value === 'string'
              ? idProp.value.value
              : undefined;

          const optionsProp = settingNode.children.find((p) => p.key.value === 'options');
          if (!optionsProp || !isArrayNode(optionsProp.value)) continue;

          const allowedValues: string[] = [];
          for (const optionNode of optionsProp.value.children) {
            if (!isObjectNode(optionNode)) continue;
            const valueProp = optionNode.children.find((p) => p.key.value === 'value');
            if (!valueProp || !isLiteralNode(valueProp.value)) continue;
            const v = valueProp.value.value;
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
              allowedValues.push(String(v));
            }
          }

          const defaultProp = settingNode.children.find((p) => p.key.value === 'default');
          if (!defaultProp || !isLiteralNode(defaultProp.value)) continue;
          const defaultValue = defaultProp.value.value;
          if (
            typeof defaultValue !== 'string' &&
            typeof defaultValue !== 'number' &&
            typeof defaultValue !== 'boolean'
          ) {
            continue;
          }

          if (!allowedValues.includes(String(defaultValue))) {
            const id = idValue ?? 'unknown';
            const allowed = allowedValues.map((v) => `"${v}"`).join(', ');
            context.report({
              message: `Default value ${JSON.stringify(
                defaultValue,
              )} for setting "${id}" is not one of the valid options: ${allowed}.`,
              startIndex: getLocStart(defaultProp.value),
              endIndex: getLocEnd(defaultProp.value),
            });
          }
        }
      },
    };
  },
};
