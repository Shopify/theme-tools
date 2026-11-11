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
import { getSchema } from '../../to-schema';

// Shopify rejects range settings whose step count exceeds 101. The CLI
// uploads the file fine, but `shopify theme dev` and the theme editor
// surface this as:
//   Invalid schema: setting with id="…" step invalid.
//   Range settings must have at most 101 steps
// which is a hard 500 on the entire local theme server.
//
// Step count is (max - min) / step + 1.

const MAX_STEPS = 101;
const EPSILON = 1e-9;

const meta = {
  code: 'ValidRangeStepCount',
  name: 'Validate that range settings have at most 101 steps',
  docs: {
    description:
      'Warns when a range setting has more than 101 discrete steps, which the storefront rejects with "Range settings must have at most 101 steps".',
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-range-step-count',
  },
  severity: Severity.ERROR,
  schema: {},
  targets: [],
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function rawStepCount(min: number, max: number, step: number): number {
  return (max - min) / step + 1;
}

function exceedsMaxSteps(min: number, max: number, step: number): boolean {
  // EPSILON absorbs float jitter so e.g. step 0.1 across (1, 5) doesn't
  // tip from 41 to 41.00000000000001 and trip the > 101 comparison.
  return rawStepCount(min, max, step) > MAX_STEPS + EPSILON;
}

function tooManyStepsMessage(id: string, min: number, max: number, step: number): string {
  const count = Math.round(rawStepCount(min, max, step));
  // Smallest step that keeps (max - min) / step + 1 <= 101.
  const suggestion = (max - min) / (MAX_STEPS - 1);
  return `Range setting "${id}" has ${count} steps (min ${min}, max ${max}, step ${step}). Shopify allows at most ${MAX_STEPS} steps — use step ≥ ${suggestion}.`;
}

type RangeSettingShape = { id: string; min: number; max: number; step: number };

function readRangeShape(setting: Setting.Any): RangeSettingShape | undefined {
  if (!setting || typeof setting !== 'object') return;
  if (!('type' in setting) || setting.type !== 'range') return;
  if (!('id' in setting) || typeof setting.id !== 'string') return;
  const { min, max, step } = setting as { min?: unknown; max?: unknown; step?: unknown };
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(step)) return;
  if (step <= 0) return;
  return { id: setting.id, min, max, step };
}

export const ValidRangeStepCount: LiquidCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.LiquidHtml },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;
        if (!validSchema.settings) return;

        const offset = node.blockStartPosition.end;

        for (let i = 0; i < validSchema.settings.length; i++) {
          const setting = validSchema.settings[i];
          const range = readRangeShape(setting);
          if (!range) continue;
          if (!exceedsMaxSteps(range.min, range.max, range.step)) continue;

          const stepNode = nodeAtPath(ast, ['settings', i, 'step']);
          reportAtNode(
            context,
            offset,
            stepNode,
            tooManyStepsMessage(range.id, range.min, range.max, range.step),
          );
        }
      },
    };
  },
};

function reportAtNode(
  context: Parameters<LiquidCheckDefinition['create']>[0],
  offset: number,
  astNode: JSONNode | undefined,
  message: string,
) {
  if (!astNode) return;
  context.report({
    message,
    startIndex: offset + getLocStart(astNode),
    endIndex: offset + getLocEnd(astNode),
  });
}

export const ValidRangeStepCountSettingsSchema: JSONCheckDefinition = {
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
          if (!minProp || !maxProp || !stepProp) continue;
          if (
            !isLiteralNode(minProp.value) ||
            !isLiteralNode(maxProp.value) ||
            !isLiteralNode(stepProp.value)
          ) {
            continue;
          }

          const min = minProp.value.value;
          const max = maxProp.value.value;
          const step = stepProp.value.value;
          if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(step)) continue;
          if (step <= 0) continue;
          if (!exceedsMaxSteps(min, max, step)) continue;

          context.report({
            message: tooManyStepsMessage(idValue, min, max, step),
            startIndex: getLocStart(stepProp.value),
            endIndex: getLocEnd(stepProp.value),
          });
        }
      },
    };
  },
};
