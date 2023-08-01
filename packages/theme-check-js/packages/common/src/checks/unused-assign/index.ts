import {
  LiquidTag,
  LiquidTagAssign,
} from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import {
  LiquidCheckDefinition,
  LiquidHtmlNodeTypes as NodeTypes,
  Severity,
  SourceCodeType,
} from '../../types';

export const UnusedAssign: LiquidCheckDefinition = {
  meta: {
    code: 'UnusedAssign',
    name: 'Prevent unused assigns',
    docs: {
      description:
        'This check exists to prevent bloat in themes by surfacing variable definitions that are not used.',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/unused-assign',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const assignedVariables: Map<string, LiquidTagAssign> = new Map();
    const usedVariables: Set<string> = new Set();

    function checkVariableUsage(node: any) {
      if (node.type === NodeTypes.VariableLookup) {
        usedVariables.add(node.name);
      }
    }

    return {
      async LiquidTag(node) {
        if (!isLiquidTagAssign(node)) return;
        assignedVariables.set(node.markup.name, node);
      },

      async VariableLookup(node) {
        checkVariableUsage(node);
      },

      async onCodePathEnd() {
        for (const [variable, node] of assignedVariables.entries()) {
          if (!usedVariables.has(variable)) {
            context.report({
              message: `The variable '${variable}' is assigned but not used`,
              startIndex: node.position.start,
              endIndex: node.position.end,
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
