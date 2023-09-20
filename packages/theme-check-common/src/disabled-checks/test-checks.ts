import { LiquidCheckDefinition, Severity, SourceCodeType } from '..';
import { NodeTypes } from '@shopify/liquid-html-parser';

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

export const RenderMarkup: LiquidCheckDefinition = {
  meta: {
    code: 'RenderMarkup',
    name: 'Complains about every RenderMarkup',
    docs: {
      description: 'Complains about every RenderMarkup',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async RenderMarkup(node) {
        if (node.snippet.type === NodeTypes.VariableLookup) {
          return;
        }

        context.report({
          message: `'${node.snippet.value}.liquid' can not be rendered`,
          startIndex: node.snippet.position.start,
          endIndex: node.snippet.position.end,
        });
      },
    };
  },
};
