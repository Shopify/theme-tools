import {
  ForMarkup,
  LiquidTag,
  LiquidTagFor,
  LiquidTagTablerow,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType, TagEntry } from '../../..';
import {
  doesFragmentContainUnsupportedParentheses,
  getFragmentsInMarkup,
  fragmentKeyValuePair,
} from './utils';
import { isLoopLiquidTag } from '../../utils';

export function detectInvalidLoopArguments(
  node: LiquidTag,
  tags: TagEntry[] = [],
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (node.type === NodeTypes.LiquidTag && !isLoopLiquidTag(node)) {
    return;
  }

  let markup: ForMarkup | string = (node as LiquidTagFor | LiquidTagTablerow).markup;

  if (!markup) {
    return;
  }

  if (typeof markup !== 'string') {
    markup = markup.source.slice(markup.position.start, markup.position.end);
  }

  const fragments = getFragmentsInMarkup(markup);

  // The first three fragments are: `<variable> in <array>`
  // If they haven't started typing the tag, we don't want to report an error.
  if (fragments.length <= 3) {
    return;
  }

  const markupIndex = node.source.indexOf(markup, node.position.start);
  let startIndex = markupIndex + fragments.at(3)!.index!;
  let endIndex = markupIndex + fragments.at(-1)!.index! + fragments.at(-1)!.value.length;

  const filteredFragments: string[] = [];

  // Positional arguments are ignored if they come after invalid positional args or named args
  let noMorePositionalArguments = false;
  const invalidFragments: string[] = [];

  for (let i = 3; i < fragments.length; i++) {
    const fragment = fragments[i];

    if (doesFragmentContainUnsupportedParentheses(fragment.value)) {
      noMorePositionalArguments = true;
      invalidFragments.push(fragment.value);
      continue;
    }

    const keyValuePair = fragmentKeyValuePair(fragment.value);

    // Named arg is found
    if (keyValuePair) {
      noMorePositionalArguments = true;

      if (!isSupportedTagArgument(tags, node.name, keyValuePair.key, false)) {
        invalidFragments.push(fragment.value);
        continue;
      }
    }
    // Unsupported positional arg is found
    else if (
      noMorePositionalArguments ||
      !isSupportedTagArgument(tags, node.name, fragment.value, true)
    ) {
      noMorePositionalArguments = true;
      invalidFragments.push(fragment.value);
      continue;
    }

    filteredFragments.push(fragment.value);
  }

  if (invalidFragments.length === 0) {
    return;
  }

  return {
    message: `Arguments must be provided in the format \`${
      node.name
    } in <array> <positional arguments> <named arguments>\`. Invalid/Unknown arguments: ${invalidFragments.join(
      ', ',
    )}`,
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, filteredFragments.join(' '));
    },
  };
}

function isSupportedTagArgument(
  tags: TagEntry[],
  tagName: string,
  key: string,
  positional: boolean,
) {
  return (
    tags
      .find((tag) => tag.name === tagName)
      ?.parameters?.some(
        (parameter) => parameter.name === key && parameter.positional === positional,
      ) || false
  );
}
