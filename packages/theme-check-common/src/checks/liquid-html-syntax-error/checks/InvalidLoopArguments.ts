import { LiquidTag, LiquidTagFor, LiquidTagTablerow, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType, TagEntry } from '../../..';
import { doesFragmentContainUnsupportedParentheses, getFragmentsInMarkup, fragmentKeyValuePair } from './utils';
import { isLoopLiquidTag } from '../../utils';

export function detectInvalidLoopArguments(
  node: LiquidTag,
  tags: TagEntry[] = [],
): Problem<SourceCodeType.LiquidHtml> | undefined {
  if (node.type === NodeTypes.LiquidTag && !isLoopLiquidTag(node)) {
    return;
  }

  const markup = (node as LiquidTagFor | LiquidTagTablerow).markup;

  if (!markup) {
    return;
  }

  if (typeof markup !== 'string') return;

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

  for (let i = 3; i < fragments.length; i++) {
    const fragment = fragments[i];

    if (doesFragmentContainUnsupportedParentheses(fragment.value)) {
      continue;
    }

    const keyValuePair = fragmentKeyValuePair(fragment.value);

    if (keyValuePair && !isSupportedTagArgument(tags, node.name, keyValuePair.key, false)) {
      continue;
    }

    if (!isSupportedTagArgument(tags, node.name, fragment.value, true)) {
      continue;
    }

    // TODO: Consider reordering the fragments so that positional arguments are before named arguments
    // But this might change the functionality of the loop
    filteredFragments.push(fragment.value);
  }

  return {
    message: 'Loop arguments must be `reversed` or named arguments.',
    startIndex,
    endIndex,
    fix: (corrector) => {
      corrector.replace(startIndex, endIndex, filteredFragments.join(' '));
    },
  };
}

function isSupportedTagArgument(tags: TagEntry[], tagName: string, key: string, positional: boolean) {
  return tags.find((tag) => tag.name === tagName)?.parameters?.some((parameter) => parameter.name === key && parameter.positional === positional) || false;
}
