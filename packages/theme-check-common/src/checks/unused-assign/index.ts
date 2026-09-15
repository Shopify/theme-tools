import {
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagAssign,
  LiquidTagCapture,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getSchema } from '../../to-schema';
import { isWithinRawTagThatDoesNotParseItsContents } from '../utils';
import { getVariableLookupsInExpression } from '../valid-visible-if/visible-if-utils';

export const UnusedAssign: LiquidCheckDefinition = {
  meta: {
    code: 'UnusedAssign',
    name: 'Prevent unused assigns',
    docs: {
      description:
        'This check exists to prevent bloat in themes by surfacing variable definitions that are not used.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-assign',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const assignedVariables: Map<string, LiquidTagAssign | LiquidTagCapture> = new Map();
    const usedVariables: Set<string> = new Set();

    function checkVariableUsage(node: any) {
      if (node.type === NodeTypes.VariableLookup) {
        usedVariables.add(node.name);
      }
    }

    return {
      async LiquidTag(node, ancestors) {
        if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;
        if (isLiquidTagAssign(node)) {
          assignedVariables.set(node.markup.name, node);
        } else if (isLiquidTagCapture(node) && node.markup.name) {
          assignedVariables.set(node.markup.name, node);
        }
      },

      async VariableLookup(node, ancestors) {
        if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;
        const parentNode = ancestors.at(-1);
        if (parentNode && isLiquidTagCapture(parentNode)) {
          return;
        }
        checkVariableUsage(node);
      },

      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const schema = await getSchema(context);
        const validSchema = schema?.validSchema;
        if (!validSchema || validSchema instanceof Error) return;

        for (const setting of validSchema.settings ?? []) {
          if (!('visible_if' in setting) || typeof setting.visible_if !== 'string') continue;

          const lookups = getVariableLookupsInExpression(setting.visible_if);
          if (!lookups || 'warning' in lookups) continue;

          for (const lookup of lookups) {
            if (lookup.name) usedVariables.add(lookup.name);
          }
        }
      },

      async onCodePathEnd() {
        for (const [variable, node] of assignedVariables.entries()) {
          if (!usedVariables.has(variable) && !variable.startsWith('_')) {
            context.report({
              message: `The variable '${variable}' is assigned but not used`,
              startIndex: isLiquidTagCapture(node)
                ? node.blockStartPosition.start
                : node.position.start,
              endIndex: isLiquidTagCapture(node) ? node.blockStartPosition.end : node.position.end,
              suggest: [
                {
                  message: `Remove the unused variable '${variable}'`,
                  fix: (corrector) => corrector.remove(node.position.start, node.position.end),
                },
              ],
            });
          }
        }
      },
    };
  },
};

function isLiquidTagAssign(node: LiquidTag): node is LiquidTagAssign {
  return node.name === 'assign' && typeof node.markup !== 'string';
}

function isLiquidTagCapture(node: LiquidHtmlNode): node is LiquidTagCapture {
  return (
    node.type == NodeTypes.LiquidTag && node.name === 'capture' && typeof node.markup !== 'string'
  );
}
