import {
  JSONCheckDefinition,
  JSONNode,
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
  isArrayNode,
  isLiteralNode,
  isObjectNode,
} from '../../types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema, isSectionSchema } from '../../to-schema';
import {
  EPSILON,
  RangeSetting,
  isFiniteNumber,
  literalValues,
  settingDefinitions,
  toRangeSetting,
} from './range-setting';

// Note: like ValidVisibleIf, this exports two checks with the same code: one
// for Liquid files ({% schema %} in sections/blocks) and one for
// 'config/settings_schema.json'. Same logic, two surface points.

// Storefronts reject schemas where a `range` setting's `default` falls outside
// [min, max] or off the (min + n*step) grid. The CLI uploads the file fine,
// but `shopify theme dev` and the theme editor surface this as a hard
// "Invalid schema" error at render time. This check catches it statically.

const meta = {
  code: 'ValidRangeDefault',
  name: 'Validate default values and preset values for range settings',
  docs: {
    description:
      "Reports a range setting's default value, or a preset's value for it, that is outside [min, max] or not aligned to the step grid.",
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-range-default',
  },
  severity: Severity.ERROR,
  schema: {},
  targets: [],
};

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
        const report = (astNode: JSONNode | undefined, message: string) => {
          if (!astNode) return;
          context.report({
            message,
            startIndex: offset + getLocStart(astNode),
            endIndex: offset + getLocEnd(astNode),
          });
        };

        // 1. The defaults of the schema's settings and of its local blocks' settings
        for (const { path, settings } of settingDefinitions(validSchema)) {
          settings.forEach((setting, i) => {
            const range = toRangeSetting(setting);
            if (!range || !isFiniteNumber(range.default)) return;
            const problem = rangeProblem(range, range.default);
            if (!problem) return;
            report(
              nodeAtPath(ast, [...path, i, 'default']),
              `Default value ${range.default} for range setting "${range.id}" ${problem}.`,
            );
          });
        }

        // 2. The values that presets and a section's default give the schema's settings
        const rangeSettings = new Map<string, RangeSetting>();
        for (const setting of Array.isArray(validSchema.settings) ? validSchema.settings : []) {
          const range = toRangeSetting(setting);
          if (range) rangeSettings.set(range.id, range);
        }
        if (rangeSettings.size === 0) return;

        const valuePaths: (string | number)[][] = [];
        if (Array.isArray(validSchema.presets)) {
          validSchema.presets.forEach((_, i) => valuePaths.push(['presets', i, 'settings']));
        }
        if (isSectionSchema(schema)) valuePaths.push(['default', 'settings']);

        for (const path of valuePaths) {
          const settingsNode = nodeAtPath(ast, path);
          if (!settingsNode || !isObjectNode(settingsNode)) continue;

          for (const property of settingsNode.children) {
            const range = rangeSettings.get(property.key.value);
            if (!range) continue;
            const valueNode = property.value;
            if (!isLiteralNode(valueNode) || !isFiniteNumber(valueNode.value)) continue;
            const problem = rangeProblem(range, valueNode.value);
            if (!problem) continue;
            report(
              valueNode,
              `Value ${valueNode.value} for range setting "${range.id}" ${problem}.`,
            );
          }
        }
      },
    };
  },
};

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
          const range = toRangeSetting(literalValues(settingNode));
          if (!range || !isFiniteNumber(range.default)) continue;
          const problem = rangeProblem(range, range.default);
          if (!problem) continue;

          const defaultNode = settingNode.children.find((p) => p.key.value === 'default')!.value;
          context.report({
            message: `Default value ${range.default} for range setting "${range.id}" ${problem}.`,
            startIndex: getLocStart(defaultNode),
            endIndex: getLocEnd(defaultNode),
          });
        }
      },
    };
  },
};

function rangeProblem({ min, max, step }: RangeSetting, value: number): string | undefined {
  if (value < min || value > max) return `is outside the range [${min}, ${max}]`;
  const ratio = (value - min) / step;
  if (Math.abs(ratio - Math.round(ratio)) >= EPSILON) {
    return `is not aligned to step ${step} in range [${min}, ${max}]`;
  }
}
