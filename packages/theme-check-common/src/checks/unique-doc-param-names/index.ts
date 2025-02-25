import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const UniqueDocParamNames: LiquidCheckDefinition = {
  meta: {
    code: 'UniqueDocParamNames',
    name: 'Unique doc parameter names',
    docs: {
      description:
        'This check exists to ensure any parameter names defined in the `doc` tag are unique.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unique-doc-param-names',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const definedLiquidDocParamNames: Set<string> = new Set();

    return {
      async LiquidDocParamNode(node) {
        const paramName = node.paramName.value;

        if (!definedLiquidDocParamNames.has(paramName)) {
          definedLiquidDocParamNames.add(paramName);
          return;
        }

        context.report({
          message: `The parameter '${paramName}' is defined more than once.`,
          startIndex: node.paramName.position.start,
          endIndex: node.paramName.position.end,
        });
      },
    };
  },
};
