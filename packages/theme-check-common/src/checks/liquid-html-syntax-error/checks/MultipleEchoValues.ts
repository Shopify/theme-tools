import { LiquidTag, LiquidVariableOutput, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { ensureValidAst, getFirstValueInMarkup, INVALID_SYNTAX_MESSAGE } from './utils';

export function detectMultipleEchoValues(
  node: LiquidTag | LiquidVariableOutput,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  // We've broken it up into two groups:
  // 1. The variable(s)
  // 2. The filter section (non-captured)
  const ECHO_MARKUP_REGEX = /([^|]*)(?:\s*\|\s*.*)?$/m;

  if (node.type === NodeTypes.LiquidTag && node.name !== 'echo') {
    return;
  }

  const markup = node.markup;

  if (typeof markup !== 'string') {
    return;
  }

  const match = markup.match(ECHO_MARKUP_REGEX);
  if (!match) {
    return;
  }

  const [, echoValue] = match;

  const firstEchoValue = getFirstValueInMarkup(echoValue);

  if (!firstEchoValue) {
    return;
  }

  const removalIndices = (source: string) => {
    const offset = source.indexOf(markup);

    return {
      startIndex: offset + firstEchoValue.length,
      endIndex: offset + echoValue.trimEnd().length,
    };
  };

  const tagSource = node.source.slice(node.position.start, node.position.end);
  const { startIndex: tagSourceRemovalStartIndex, endIndex: tagSourceRemovalEndIndex } =
    removalIndices(tagSource);

  if (
    !ensureValidAst(
      tagSource.slice(0, tagSourceRemovalStartIndex) + tagSource.slice(tagSourceRemovalEndIndex),
    )
  ) {
    // If the new AST is invalid, we don't want to auto-fix it
    return;
  }

  const { startIndex, endIndex } = removalIndices(node.source);

  return {
    message: INVALID_SYNTAX_MESSAGE,
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, '');
    },
  };
}
