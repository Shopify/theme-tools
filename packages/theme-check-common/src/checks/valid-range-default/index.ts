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

// Note: like ValidVisibleIf and ValidSelectDefault, this exports two checks:
// one for Liquid files ({% schema %} in sections/blocks) and one for
// 'config/settings_schema.json'. Same logic, two surface points.

// Storefronts reject schemas where a `range` setting's `default` falls outside
// [min, max] or off the (min + n*step) grid. The CLI uploads the file fine,
// but `shopify theme dev` and the theme editor surface this as a hard
// "Invalid schema" error at render time. This check catches it statically.

const EPSILON = 1e-9;

const meta = {
  code: 'ValidRangeDefault',
  name: 'Validate default values and preset values for range settings',
  docs: {
    description:
      "Warns when a range setting's default value (or a preset's setting value) is outside [min, max] or not aligned to the step grid.",
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-range-default',
  },
  severity: Severity.ERROR,
  schema: {},
  targets: [],
};

type RangeSetting = {
  id: string;
  type: 'range';
  min: number;
  max: number;
  step: number;
  default?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getRangeSettings(settings: readonly Setting.Any[] | undefined): RangeSetting[] {
  if (!settings) return [];
  const result: RangeSetting[] = [];
  for (const setting of settings) {
    if (!setting || typeof setting !== 'object') continue;
    if (!('type' in setting) || setting.type !== 'range') continue;
    if (!('id' in setting) || typeof setting.id !== 'string') continue;
    const { min, max, step } = setting as { min?: unknown; max?: unknown; step?: unknown };
    if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(step)) continue;
    if (step <= 0) continue;
    result.push(setting as unknown as RangeSetting);
  }
  return result;
}

function isOnStepGrid(setting: RangeSetting, value: number): boolean {
  const ratio = (value - setting.min) / setting.step;
  return Math.abs(ratio - Math.round(ratio)) < EPSILON;
}

function nearestValidValue(setting: RangeSetting, value: number): number {
  const clamped = Math.min(setting.max, Math.max(setting.min, value));
  const steps = Math.round((clamped - setting.min) / setting.step);
  const candidate = setting.min + steps * setting.step;
  return Math.min(setting.max, Math.max(setting.min, candidate));
}

function rangeProblem(setting: RangeSetting, value: number): string | undefined {
  if (value < setting.min || value > setting.max) {
    return `is outside the range [${setting.min}, ${setting.max}]`;
  }
  if (!isOnStepGrid(setting, value)) {
    const suggestion = nearestValidValue(setting, value);
    return `is not aligned to step ${setting.step} in range [${setting.min}, ${setting.max}] — try ${suggestion}`;
  }
  return undefined;
}

function invalidDefaultMessage(setting: RangeSetting, value: number): string {
  return `Default value ${value} for range setting "${setting.id}" ${rangeProblem(setting, value)}.`;
}

function invalidPresetMessage(setting: RangeSetting, value: number): string {
  return `Value ${value} for range setting "${setting.id}" ${rangeProblem(setting, value)}.`;
}

export const ValidRangeDefault: LiquidCheckDefinition = {
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
        const rangeSettings = getRangeSettings(validSchema.settings);
        if (rangeSettings.length === 0) return;

        const settingsById = new Map(rangeSettings.map((s) => [s.id, s]));

        // 1. Validate setting defaults
        for (let i = 0; i < (validSchema.settings?.length ?? 0); i++) {
          const setting = validSchema.settings![i];
          if (!setting || !('id' in setting)) continue;
          const range = settingsById.get(setting.id as string);
          if (!range) continue;
          if (!('default' in range) || range.default === undefined) continue;
          if (!isFiniteNumber(range.default)) continue;
          if (!rangeProblem(range, range.default)) continue;

          const defaultNode = nodeAtPath(ast, ['settings', i, 'default']);
          if (defaultNode) {
            reportAtNode(context, offset, defaultNode, invalidDefaultMessage(range, range.default));
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
              settingsById,
            );
          }
        }

        // 3. Validate section default.settings values
        if (isSectionSchema(schema) && 'default' in validSchema && validSchema.default?.settings) {
          validatePresetSettings(context, offset, ast, ['default', 'settings'], settingsById);
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
  settingsById: Map<string, RangeSetting>,
) {
  const settingsNode = nodeAtPath(ast, settingsPath);
  if (!settingsNode || !isObjectNode(settingsNode)) return;

  for (const property of settingsNode.children) {
    const key = property.key.value;
    if (typeof key !== 'string') continue;
    const range = settingsById.get(key);
    if (!range) continue;

    const valueNode = property.value;
    if (!isLiteralNode(valueNode)) continue;
    if (!isFiniteNumber(valueNode.value)) continue;
    if (!rangeProblem(range, valueNode.value)) continue;

    reportAtNode(context, offset, valueNode, invalidPresetMessage(range, valueNode.value));
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

export const ValidRangeDefaultSettingsSchema: JSONCheckDefinition = {
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
          if (!typeProp || !isLiteralNode(typeProp.value) || typeProp.value.value !== 'range') {
            continue;
          }

          const idProp = settingNode.children.find((p) => p.key.value === 'id');
          const idValue =
            idProp && isLiteralNode(idProp.value) && typeof idProp.value.value === 'string'
              ? idProp.value.value
              : 'unknown';

          const minProp = settingNode.children.find((p) => p.key.value === 'min');
          const maxProp = settingNode.children.find((p) => p.key.value === 'max');
          const stepProp = settingNode.children.find((p) => p.key.value === 'step');
          const defaultProp = settingNode.children.find((p) => p.key.value === 'default');
          if (!minProp || !maxProp || !stepProp || !defaultProp) continue;
          if (
            !isLiteralNode(minProp.value) ||
            !isLiteralNode(maxProp.value) ||
            !isLiteralNode(stepProp.value) ||
            !isLiteralNode(defaultProp.value)
          ) {
            continue;
          }

          const min = minProp.value.value;
          const max = maxProp.value.value;
          const step = stepProp.value.value;
          const defaultValue = defaultProp.value.value;
          if (
            !isFiniteNumber(min) ||
            !isFiniteNumber(max) ||
            !isFiniteNumber(step) ||
            !isFiniteNumber(defaultValue)
          ) {
            continue;
          }
          if (step <= 0) continue;

          const range: RangeSetting = { id: idValue, type: 'range', min, max, step };
          const problem = rangeProblem(range, defaultValue);
          if (!problem) continue;

          context.report({
            message: `Default value ${defaultValue} for range setting "${idValue}" ${problem}.`,
            startIndex: getLocStart(defaultProp.value),
            endIndex: getLocEnd(defaultProp.value),
          });
        }
      },
    };
  },
};
