import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
const LeftSideEvaluation = /^(['"][^'"]*['"]|\d+(?:\.\d+)?|true|false|nil|empty|blank)\s+((?![a-zA-Z_])\S.*)/;
const TrailingJunk = /^(.+?(?:==|!=|>=|<=|>|<|contains)\s+\S+)\s+(.+?)(?:\s+(?:and|or)\s|$)/;
const Comparison = /^\s*(==|!=|>=|<=|>|<|contains)\s/;
const LogicalOperator = /^(?:and|or)\s/;

export const BooleanExpression: LiquidCheckDefinition = {
  meta: {
    code: 'BooleanExpression',
    name: 'Boolean expressions with lax parsing issues',
    docs: {
      description:
        'Detects boolean expressions that behave differently due to Liquid\'s lax parsing.',
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

      const leftSideMatch = LeftSideEvaluation.exec(trimmed);
      if (leftSideMatch) {
        const [, leftValue, rest] = leftSideMatch;
        // Check if the remaining string is a valid comparison
        if (!Comparison.test(rest)) {
          return {
            issue: `Expression stops at truthy value '${leftValue}', ignoring: '${rest}'`,
            fix: leftValue
          };
        }
      }

      const trailingMatch = TrailingJunk.exec(trimmed);
      if (trailingMatch) {
        const [, comparison, trailing] = trailingMatch;
        if (!LogicalOperator.test(trailing)) {
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
        message: `Liquid lax parsing issue: ${issue.issue}`,
        startIndex,
        endIndex,
        fix: (corrector) => {
          corrector.replace(startIndex, endIndex, issue.fix);
        },
      });
    }

    return {
      async LiquidTag(node) {
        await checkConditional(node);
      },
      async LiquidBranch(node) {
        await checkConditional(node);
      },
    };
  },
};

export default BooleanExpression;
