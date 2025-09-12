import { LiquidTag, LiquidTagFor, LiquidTagTablerow, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { getRangeMatch } from './utils';
import { isLoopLiquidTag } from '../../utils';

export const INVALID_LOOP_RANGE_MESSAGE =
  'Ranges must be in the format `(<start>..<end>)`. The start and end of the range must be whole numbers or variables.';

export function detectInvalidLoopRange(
  node: LiquidTag,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (node.type === NodeTypes.LiquidTag && !isLoopLiquidTag(node)) {
    return;
  }

  const markup = (node as LiquidTagFor | LiquidTagTablerow).markup;

  if (!markup) {
    return;
  }

  if (typeof markup === 'string') {
    return validateMarkup(node, markup);
  }

  if (markup.collection.type === NodeTypes.Range) {
    return validateMarkup(
      node,
      node.source.slice(markup.collection.position.start, markup.collection.position.end),
    );
  }
}

function validateMarkup(
  node: LiquidTag,
  markup: string,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  const match = getRangeMatch(markup);
  if (!match || match.index === undefined) {
    return;
  }

  const [fullMatch, start, , end] = match;

  let startCleaned = start;
  let endCleaned = end;

  if (!isNaN(Number(start)) && Number(start) % 1 !== 0) {
    startCleaned = `${Math.trunc(Number(start))}`;
  }
  if (!isNaN(Number(end)) && Number(end) % 1 !== 0) {
    endCleaned = `${Math.trunc(Number(end))}`;
  }

  const expectedRangeMarkup = `(${startCleaned}..${endCleaned})`;

  if (markup.slice(match.index, match.index + fullMatch.length) === expectedRangeMarkup) {
    return;
  }

  const markupIndex = node.source.indexOf(markup, node.position.start);

  const startIndex = markupIndex + match.index;
  const endIndex = startIndex + fullMatch.length;

  return {
    message: INVALID_LOOP_RANGE_MESSAGE,
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, expectedRangeMarkup);
    },
  };
}
