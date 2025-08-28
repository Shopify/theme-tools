import { LiquidBranch, LiquidTag } from '@shopify/liquid-html-parser';
import { Check, Context, SourceCodeType, Problem } from '../../..';

const LeftSideEvaluation =
  /^(['"][^'"]*['"]|\d+(?:\.\d+)?|true|false|nil|empty|blank)\s+((?![a-zA-Z_])\S.*)/;
const TrailingJunk = /^(.+?(?:==|!=|>=|<=|>|<|contains)\s+\S+)\s+(.+?)(?:\s+(?:and|or)\s|$)/;
const Comparison = /^\s*(==|!=|>=|<=|>|<|contains)\s/;
const LogicalOperator = /^(?:and|or)\s/;

export function detectInvalidConditionalNode(
  node: LiquidBranch | LiquidTag,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (!('name' in node) || !node.name) return;
  if (!['if', 'elsif', 'unless'].includes(String(node.name))) return;

  const markup = node.markup;
  if (typeof markup !== 'string' || !markup.trim()) return;

  const issue = checkLaxParsing(markup);
  if (!issue) return;

  const openingTagRange = node.blockStartPosition || node.position;
  const openingTag = node.source.slice(openingTagRange.start, openingTagRange.end);
  const markupOffsetInOpening = openingTag.indexOf(markup);
  if (markupOffsetInOpening < 0) return;

  const startIndex = openingTagRange.start + markupOffsetInOpening;
  const endIndex = startIndex + markup.length;

  return {
    message: `Liquid lax parsing issue: ${issue.issue}`,
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, issue.fix);
    },
  };
}

function checkLaxParsing(markup: string): { issue: string; fix: string } | null {
  const trimmed = markup.trim();

  // Pattern 1: Left-side evaluation - parser stops at first complete value
  // EX: {% if 7 1 > 100 %}hello{% endif %} <-- Lax parsing will ignore everything after 7 so we will remove 1 > 100
  const leftSideMatch = LeftSideEvaluation.exec(trimmed);
  if (leftSideMatch) {
    const [, leftValue, rest] = leftSideMatch;
    // Check if the remaining string would create a valid comparison or logical operator
    if (!Comparison.test(rest) && !LogicalOperator.test(rest)) {
      return {
        issue: `Expression stops at truthy value '${leftValue}', ignoring: '${rest}'`,
        fix: leftValue,
      };
    }
  }

  // Pattern 2: Malformed expression starting with invalid token
  // EX: {% if 2 %}hello{% endif %} is truthy but any special character such as @#! will evaluate to false
  const malformedStart = /^([^a-zA-Z_'"\d\s(][^\s]*)/.exec(trimmed);
  if (malformedStart) {
    return {
      issue: `Malformed expression starting with invalid token '${malformedStart[1]}'`,
      fix: 'false',
    };
  }

  // Pattern 3: Trailing junk after complete comparison
  // EX: {% if 1 > 100 foobar %}hello{% endif %} Lax parsing will ignore everything after 1 > 100 so we will remove foobar
  const trailingMatch = TrailingJunk.exec(trimmed);
  if (trailingMatch) {
    const [, comparison, trailing] = trailingMatch;
    if (!LogicalOperator.test(trailing)) {
      return {
        issue: `Trailing tokens ignored after comparison: '${trailing.trim()}'`,
        fix: comparison.trim(),
      };
    }
  }

  return null;
}
