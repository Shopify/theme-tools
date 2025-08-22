import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';

export const BooleanExpression: LiquidCheckDefinition = {
  meta: {
    code: 'BooleanExpression',
    name: 'Boolean expressions with lax parsing issues',
    docs: {
      description:
        'Detects boolean expressions that behave differently due to Liquid\'s lax parsing mode and suggests fixes.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    function checkLaxParsing(markup: string): { issue: string; fix: string } | null {
      const trimmed = markup.trim();

      // Pattern 1: Left-side evaluation - truthy literal/number/string followed by junk
      // Examples: "7 1 > 100", "'hello' some stuff", "0 2 > 5"
      const leftSideMatch = /^(['"].*?['"]|\d+(?:\.\d+)?|true|empty|blank)\s+(.+)/.exec(trimmed);
      if (leftSideMatch) {
        const [, leftValue, rest] = leftSideMatch;
        // Skip if it looks like a valid comparison (has operator)
        if (!/^\s*(==|!=|>=|<=|>|<|contains)\s/.test(rest)) {
          return {
            issue: `Expression stops at truthy value '${leftValue}', ignoring: '${rest}'`,
            fix: leftValue
          };
        }
      }

      // Pattern 2: Unknown operator - variable followed by non-operator identifier
      // Examples: "my_var word > 5", "jake johnson > 5"
      const unknownOpMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[><=!]/.exec(trimmed);
      if (unknownOpMatch) {
        const [, varName, badOp] = unknownOpMatch;
        // Make sure it's not a valid logical operator
        if (!['and', 'or', 'contains'].includes(badOp)) {
          return {
            issue: `Unknown operator '${badOp}' after variable '${varName}'`,
            fix: varName
          };
        }
      }

      // Pattern 3: Trailing junk after complete comparison
      // Examples: "1 == 2 foobar", "10 > 4 baz qux", "'abc' contains 'a' noise"
      const trailingMatch = /^(.+?(?:==|!=|>=|<=|>|<|contains)\s+\S+)\s+(.+?)(?:\s+(?:and|or)\s|$)/.exec(trimmed);
      if (trailingMatch) {
        const [, comparison, trailing] = trailingMatch;
        // Make sure the trailing part isn't just another logical condition
        if (!/^(?:and|or)\s/.test(trailing)) {
          return {
            issue: `Trailing tokens ignored after comparison: '${trailing.trim()}'`,
            fix: comparison.trim()
          };
        }
      }

      return null;
    }

    return {
      async LiquidTag(node) {
        if (!('name' in node) || !node.name) return;
        if (!['if', 'elsif', 'unless'].includes(String(node.name))) return;

        const markup: any = (node as any).markup;
        if (typeof markup !== 'string' || !markup.trim()) return;

        const issue = checkLaxParsing(markup);
        if (!issue) return;

        const openingTagRange = (node as any).blockStartPosition;
        const openingTag = (node as any).source.slice(openingTagRange.start, openingTagRange.end);
        const markupOffsetInOpening = openingTag.indexOf(markup);
        if (markupOffsetInOpening < 0) return;

        const startIndex = openingTagRange.start + markupOffsetInOpening;
        const endIndex = startIndex + markup.length;

        context.report({
          message: `Lax parsing issue: ${issue.issue}`,
          startIndex,
          endIndex,
          fix: (corrector) => {
            corrector.replace(startIndex, endIndex, issue.fix);
          },
        });
      },
    };
  },
};

export default BooleanExpression;


