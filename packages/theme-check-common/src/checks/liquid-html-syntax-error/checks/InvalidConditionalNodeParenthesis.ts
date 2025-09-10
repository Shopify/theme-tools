import { LiquidTag } from '@shopify/liquid-html-parser';
import { SourceCodeType, Problem } from '../../..';
import {
  doesFragmentContainUnsupportedParentheses,
  getFragmentsInMarkup,
  INVALID_SYNTAX_MESSAGE,
} from './utils';

export function detectConditionalNodeUnsupportedParenthesis(
  node: LiquidTag,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (!['if', 'elsif', 'unless'].includes(node.name)) return;
  if (typeof node.markup !== 'string' || !node.markup.trim()) return;

  const markupIndex = node.source.indexOf(node.markup, node.position.start);

  const fragments = getFragmentsInMarkup(node.markup);

  const badFragments = fragments.filter((fragment) =>
    doesFragmentContainUnsupportedParentheses(fragment.value),
  );

  if (badFragments.length) {
    return {
      message: INVALID_SYNTAX_MESSAGE,
      startIndex: markupIndex,
      endIndex: markupIndex + node.markup.length,
      fix: (corrector) => {
        for (const fragment of badFragments) {
          corrector.replace(
            markupIndex + fragment.index!,
            markupIndex + fragment.index! + fragment.value.length,
            fragment.value.replace(/[\(\)]/g, ''),
          );
        }
      },
    };
  }
}
