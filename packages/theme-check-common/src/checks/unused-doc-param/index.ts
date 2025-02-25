import { LiquidDocParamNode, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isLoopScopedVariable } from '../utils';

export const UnusedDocParam: LiquidCheckDefinition = {
  meta: {
    code: 'UnusedDocParam',
    name: 'Prevent unused doc parameters',
    docs: {
      description:
        'This check exists to ensure any parameters defined in the `doc` tag are used within the snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unused-doc-param',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const definedLiquidDocParams: Map<string, LiquidDocParamNode> = new Map();
    const usedVariables: Set<string> = new Set();

    return {
      async LiquidDocParamNode(node) {
        definedLiquidDocParams.set(node.paramName.value, node);
      },

      async VariableLookup(node, ancestors) {
        if (
          node.type === NodeTypes.VariableLookup &&
          node.name &&
          !isLoopScopedVariable(node.name, ancestors)
        ) {
          usedVariables.add(node.name);
        }
      },

      async onCodePathEnd() {
        for (const [variable, node] of definedLiquidDocParams.entries()) {
          if (!usedVariables.has(variable)) {
            context.report({
              message: `The parameter '${variable}' is defined but not used in this file.`,
              startIndex: node.position.start,
              endIndex: node.position.end,
              suggest: [
                {
                  message: `Remove unused parameter '${variable}'`,
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
