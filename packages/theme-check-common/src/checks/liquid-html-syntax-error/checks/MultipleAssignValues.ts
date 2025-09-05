import { LiquidTag } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { getValuesInMarkup, INVALID_SYNTAX_MESSAGE } from './utils';

export function detectMultipleAssignValues(
  node: LiquidTag,
): Problem<SourceCodeType.LiquidHtml> | undefined {
  // Using a regex to match the markup like we do in Shopify/liquid
  // https://github.com/Shopify/liquid/blob/9bb7fbf123e6e2bd61e00189b1c83159f375d3f3/lib/liquid/tags/assign.rb#L21
  //
  // We've broken it up into four groups:
  // 1. The variable name
  // 2. The assignment operator
  // 3. The value section
  // 4. The filter section (non-captured)
  const ASSIGN_MARKUP_REGEX = /([^=]+)(=\s*)([^|]+)(?:\s*\|\s*.*)?$/m;

  if (node.name !== 'assign') {
    return;
  }

  const markup = node.markup;

  if (typeof markup !== 'string') {
    return;
  }

  const match = markup.match(ASSIGN_MARKUP_REGEX);
  if (!match) {
    return;
  }

  // If we have a markup 'foo    =    "123" something | upcase: 123', we have the following groups
  const [
    // 'foo    =    "123" something | upcase: 123'
    _fullMatch,
    // 'foo    '
    assignmentVariable,
    // '=    '
    assignmentOperator,
    // '"123" something'
    assignmentValue,
  ] = match;

  const firstAssignmentValue = getValuesInMarkup(assignmentValue).at(0)?.value;

  if (!firstAssignmentValue) {
    return;
  }

  const removalIndices = (source: string, startingIndex: number) => {
    const offset = source.indexOf(markup, startingIndex);

    return {
      startIndex:
        offset +
        assignmentVariable.length +
        assignmentOperator.length +
        firstAssignmentValue.length,
      endIndex:
        offset +
        assignmentVariable.length +
        assignmentOperator.length +
        assignmentValue.trimEnd().length,
    };
  };

  const { startIndex, endIndex } = removalIndices(node.source, node.position.start);

  if (endIndex <= startIndex) {
    return;
  }

  if (endIndex <= startIndex) {
    return;
  }

  return {
    message: INVALID_SYNTAX_MESSAGE,
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, '');
    },
  };
}
