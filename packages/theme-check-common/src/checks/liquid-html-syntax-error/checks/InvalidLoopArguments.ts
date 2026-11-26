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

  const markup: ForMarkup | string = (node as LiquidTagFor | LiquidTagTablerow).markup;

  if (!markup) {
    return;
  }

  let markupIndex: number;
  let fragments: ArgumentFragment[];

  if (typeof markup === 'string') {
    markupIndex = node.source.indexOf(markup, node.position.start);
    // The first three fragments are: `<variable> in <array>`
    fragments = getFragmentsInMarkup(markup)
      .slice(3)
      .map(({ value, index }) => ({ value, index: index! }));
  } else {
    markupIndex = markup.position.start;
    fragments = parsedArgumentFragments(markup);
  }

  // If they haven't started typing the arguments, we don't want to report an error.
  if (fragments.length === 0) {
    return;
  }

  const lastFragment = fragments.at(-1)!;
  const startIndex = markupIndex + fragments[0].index;
  const endIndex = markupIndex + lastFragment.index + lastFragment.value.length;

  const filteredFragments: string[] = [];

  // Positional arguments are ignored if they come after invalid positional args or named args
  let noMorePositionalArguments = false;
  const invalidFragments: string[] = [];

  for (const fragment of fragments) {
    // The parser already accepted the value of a named argument it found
    if (fragment.key === undefined && doesFragmentContainUnsupportedParentheses(fragment.value)) {
      noMorePositionalArguments = true;
      invalidFragments.push(fragment.value);
      continue;
    }

    const key = fragment.key ?? fragmentKeyValuePair(fragment.value)?.key;

    // Named arg is found
    if (key !== undefined) {
      noMorePositionalArguments = true;

      if (!isSupportedTagArgument(tags, node.name, key, false)) {
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

/** An argument of a loop tag, at an offset relative to the markup. `key` is set for a named argument the parser found. */
interface ArgumentFragment {
  value: string;
  index: number;
  key?: string;
}

/**
 * The fragments of a parsed loop's markup after `<variable> in <array>`.
 *
 * The parser already found the collection and the named arguments. Their values can be lookups
 * such as `settings['item count']`, which the fragment pattern would split at the space. So only
 * the text around them, such as `reversed` or anything the parser skipped, goes through the pattern.
 */
function parsedArgumentFragments(markup: ForMarkup): ArgumentFragment[] {
  const { source } = markup;
  const offset = markup.position.start;
  const fragments: ArgumentFragment[] = [];
  let textStart = markup.collection.position.end;

  const addTextUntil = (textEnd: number) => {
    for (const { value, index } of getFragmentsInMarkup(source.slice(textStart, textEnd))) {
      fragments.push({ value, index: textStart - offset + index! });
    }
  };

  for (const arg of markup.args) {
    addTextUntil(arg.position.start);
    fragments.push({
      value: source.slice(arg.position.start, arg.position.end),
      index: arg.position.start - offset,
      key: arg.name,
    });
    textStart = arg.position.end;
  }
  addTextUntil(markup.position.end);

  return fragments;
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
