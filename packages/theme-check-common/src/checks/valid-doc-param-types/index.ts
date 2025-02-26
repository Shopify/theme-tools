import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { SupportedParamTypes } from '../../liquid-doc/utils';

export const ValidDocParamTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidDocParamTypes',
    name: 'Valid doc parameter types',
    docs: {
      description:
        'This check exists to ensure any parameter types defined in the `doc` tag are valid.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-doc-param-types',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidDocParamNode(node) {
        if (!node.paramType) {
          return;
        }

        if (Object.values(SupportedParamTypes).includes(node.paramType.value as any)) {
          return;
        }

        context.report({
          message: `The parameter type '${node.paramType.value}' is not supported.`,
          startIndex: node.paramType.position.start,
          endIndex: node.paramType.position.end,
          suggest: [
            {
              message: 'Remove invalid parameter type',
              fix: (corrector) => {
                if (!node.paramType) return;

                corrector.replace(
                  node.position.start,
                  node.position.end,
                  node.source.slice(node.position.start, node.position.end).replace(
                    // We could have padded spaces around + inside the param type
                    // e.g. `{ string }`, `{string}`, or ` { string } `
                    new RegExp(`\\s*\\{\\s*${node.paramType.value}\\s*\\}\\s*`),
                    ' ',
                  ),
                );
              },
            },
          ],
        });
      },
    };
  },
};
