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

      // Pattern 1: Unknown operator - any value followed by non-operator identifier
      // Examples: "my_var word > 5", "'' some > thing", "jake johnson > 5"
      const unknownOpMatch = /^((['"].*?['"]|\d+(?:\.\d+)?|true|empty|blank)|[a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[><=!]/.exec(trimmed);
      if (unknownOpMatch) {
        const [, leftValue, , badOp] = unknownOpMatch;
        // Make sure it's not a valid logical operator
        if (!['and', 'or', 'contains'].includes(badOp)) {
          const leftType = /^(['"].*?['"]|\d+(?:\.\d+)?|true|empty|blank)$/.test(leftValue) ? 'value' : 'variable';
          return {
            issue: `Unknown operator '${badOp}' after ${leftType} '${leftValue}'`,
            fix: leftValue
          };
        }
      }

      // Pattern 2: Left-side evaluation - truthy literal/number/string stops parsing early
      // Examples: "7 1 > 100", "'hello' 1 > 100", "0 2 > 5"
      const leftSideMatch = /^(['"].*?['"]|\d+(?:\.\d+)?|true|empty|blank)\s+(.+)/.exec(trimmed);
      if (leftSideMatch) {
        const [, leftValue, rest] = leftSideMatch;
        // Skip if it looks like a valid comparison or unknown operator (handled above)
        if (!/^\s*(==|!=|>=|<=|>|<|contains)\s/.test(rest) &&
            !/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[><=!]/.test(rest)) {
          return {
            issue: `Expression stops at truthy value '${leftValue}', ignoring: '${rest}'`,
            fix: leftValue
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

    async function checkConditional(node: any) {
      if (!('name' in node) || !node.name) return;
      if (!['if', 'elsif', 'unless'].includes(String(node.name))) return;

      const markup: any = (node as any).markup;
      if (typeof markup !== 'string' || !markup.trim()) return;

      const issue = checkLaxParsing(markup);
      if (!issue) return;

      const openingTagRange = (node as any).blockStartPosition || (node as any).position;
      const openingTag = (node as any).source.slice(openingTagRange.start, openingTagRange.end);
      const markupOffsetInOpening = openingTag.indexOf(markup);
      if (markupOffsetInOpening < 0) return;

      const startIndex = openingTagRange.start + markupOffsetInOpening;
      const endIndex = startIndex + markup.length;

      context.report({
        message: `Liquid rendering issue: ${issue.issue}`,
        startIndex,
        endIndex,
        fix: (corrector) => {
          corrector.replace(startIndex, endIndex, issue.fix);
        },
      });
    }

    return {
      // Check for if tags
      async LiquidTag(node) {
        await checkConditional(node);
      },
      // Check for elsif
      async LiquidBranch(node) {
        await checkConditional(node);
      },
    };
  },
};

export default BooleanExpression;


