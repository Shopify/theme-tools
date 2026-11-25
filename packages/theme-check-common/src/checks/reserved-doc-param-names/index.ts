import { LiquidLiteralValues } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

const RESERVED_DOC_PARAM_NAMES = new Set(Object.keys(LiquidLiteralValues));

export const ReservedDocParamNames: LiquidCheckDefinition = {
  meta: {
    code: 'ReservedDocParamNames',
    name: 'Valid doc parameter names',
    docs: {
      description:
        'This check exists to ensure any parameter names defined in LiquidDoc do not collide with reserved words.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/reserved-doc-param-names',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidDocParamNode(node) {
        const paramName = node.paramName.value;

        if (!RESERVED_DOC_PARAM_NAMES.has(paramName)) return;

        context.report({
          message: `The parameter name '${paramName}' is reserved because Liquid parses it as a literal.`,
          startIndex: node.paramName.position.start,
          endIndex: node.paramName.position.end,
        });
      },
    };
  },
};
