import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const InvalidComparisonSyntax: LiquidCheckDefinition = {
  meta: {
    code: 'InvalidComparisonSyntax',
    name: 'Invalid syntax after comparison operator',
    docs: {
      description: 'Ensures comparison operators in Liquid if statements follow valid syntax',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/invalid-comparison',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name !== 'if' && node.name !== 'elsif' && node.name !== 'unless') {
          return;
        }

        const markup = node.markup.toString();

        const regex =
          /(>=|<=|>|<|==|!=)\s+([^\s]+)\s+([^\s]+)(?!\s+(and|or|%}|contains|startswith|endswith))/g;

        let match;
        while ((match = regex.exec(markup)) !== null) {
          const invalidToken = match[3];

          if (!isValidComparisonConnector(invalidToken)) {
            const invalidTokenOffset = match.index + match[0].lastIndexOf(invalidToken);

            const markupStart = node.position.start + node.name.length + 3;
            const startIndex = markupStart + invalidTokenOffset + 1;
            const endIndex = startIndex + invalidToken.length;

            context.report({
              message: `Invalid token '${invalidToken}' after comparison`,
              startIndex,
              endIndex,
              suggest: [
                {
                  message: `Remove '${invalidToken}'`,
                  fix: (corrector) => {
                    corrector.remove(startIndex, endIndex + 1);
                  },
                },
              ],
            });
          }
        }
      },
    };
  },
};

function isValidComparisonConnector(token: string): boolean {
  const validConnectors = ['and', 'or', '%}', 'contains', 'startswith', 'endswith'];
  return validConnectors.some((connector) => token.includes(connector));
}
