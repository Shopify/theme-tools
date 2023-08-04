import { LiquidCheckDefinition, Severity, SourceCodeType } from '@shopify/theme-check-common';

export const LiquidFilter: LiquidCheckDefinition = {
  meta: {
    code: 'LiquidFilter',
    name: 'Complains about every LiquidFilter',
    docs: {
      description: 'Complains about every LiquidFilter',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      LiquidFilter: async (node) => {
        context.report({
          message: 'Liquid filter can not be used',
          startIndex: node.position.start,
          endIndex: node.position.end,
        });
      },
    };
  },
};
