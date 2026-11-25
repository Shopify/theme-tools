import {
  JSONCheckDefinition,
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
  isArrayNode,
  isObjectNode,
} from '../../types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import {
  EPSILON,
  RangeSetting,
  literalValues,
  settingDefinitions,
  toRangeSetting,
} from '../valid-range-default/range-setting';

// Shopify rejects range settings whose step count exceeds 101. The CLI
// uploads the file fine, but `shopify theme dev` and the theme editor
// surface this as:
//   Invalid schema: setting with id="…" step invalid.
//   Range settings must have at most 101 steps
// which is a hard 500 on the entire local theme server.
//
// Step count is (max - min) / step + 1, and step defaults to 1.

const MAX_STEPS = 101;

const meta = {
  code: 'ValidRangeStepCount',
  name: 'Validate that range settings have at most 101 steps',
  docs: {
    description:
      'Reports a range setting with more than 101 discrete steps, which the storefront rejects with "Range settings must have at most 101 steps".',
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-range-step-count',
  },
  severity: Severity.ERROR,
  schema: {},
  targets: [],
};

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

        const offset = node.blockStartPosition.end;

        for (const { path, settings } of settingDefinitions(validSchema)) {
          settings.forEach((setting, i) => {
            const range = toRangeSetting(setting);
            if (!range || !exceedsMaxSteps(range)) return;

            // Without a step, the range is too wide for the default step of 1.
            const astNode =
              nodeAtPath(ast, [...path, i, 'step']) ?? nodeAtPath(ast, [...path, i, 'max']);
            if (!astNode) return;
            context.report({
              message: tooManyStepsMessage(range),
              startIndex: offset + getLocStart(astNode),
              endIndex: offset + getLocEnd(astNode),
            });
          });
        }
      },
    };
  },
};

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
          const range = toRangeSetting(literalValues(settingNode));
          if (!range || !exceedsMaxSteps(range)) continue;

          const property = (key: string) =>
            settingNode.children.find((p) => p.key.value === key)?.value;
          const astNode = (property('step') ?? property('max'))!;
          context.report({
            message: tooManyStepsMessage(range),
            startIndex: getLocStart(astNode),
            endIndex: getLocEnd(astNode),
          });
        }
      },
    };
  },
};

function rawStepCount({ min, max, step }: RangeSetting): number {
  return (max - min) / step + 1;
}

function exceedsMaxSteps(range: RangeSetting): boolean {
  // EPSILON absorbs float jitter so e.g. step 0.1 across (1, 5) doesn't
  // tip from 41 to 41.00000000000001 and trip the > 101 comparison.
  return rawStepCount(range) > MAX_STEPS + EPSILON;
}

function tooManyStepsMessage(range: RangeSetting): string {
  const { id, min, max, step } = range;
  const count = Math.round(rawStepCount(range));
  return `Range setting "${id}" has ${count} steps (min ${min}, max ${max}, step ${step}). Shopify allows at most ${MAX_STEPS} steps.`;
}
