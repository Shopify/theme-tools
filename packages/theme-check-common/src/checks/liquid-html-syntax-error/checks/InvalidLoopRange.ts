import { LiquidTag, LiquidTagFor, LiquidTagTablerow, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { ensureValidAst } from './utils';
import { isLoopLiquidTag } from '../../utils';

// Lax parser does NOT complain about leading/trailing spaces inside ranges (e.g. `(1 .. 10 )`) and
// within the parenthesis (e.g. `( 1 .. 10 )`), but fails to render the liquid when using the gem.
// Strict parser does NOT complain, but still renders it.
// To avoid any issues, we will remove extra spaces.
const RANGE_MARKUP_REGEX = /\(\s*(\w+)\s*(\.{2,})\s*(\w+)\s*\)/;

export const INVALID_LOOP_RANGE_MESSAGE =
  'Ranges must be in the following format: (<start>..<end>)';

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
  const match = markup.match(RANGE_MARKUP_REGEX);
  if (!match || match.index === undefined) {
    return;
  }

  const [, start, , end] = match;

  const expectedRangeMarkup = `(${start}..${end})`;

  if (markup.slice(match.index) === expectedRangeMarkup) {
    return;
  }

  const markupIndex = node.source.indexOf(markup, node.position.start);

  const startIndex = markupIndex + match.index;
  const endIndex = markupIndex + markup.length;

  if (
    !ensureValidAst(
      node.source.slice(node.position.start, startIndex) +
        expectedRangeMarkup +
        node.source.slice(endIndex, node.position.end),
    )
  ) {
    // If the new AST is invalid, we don't want to auto-fix it
    return;
  }

  return {
    message: INVALID_LOOP_RANGE_MESSAGE,
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, expectedRangeMarkup);
    },
  };
}
