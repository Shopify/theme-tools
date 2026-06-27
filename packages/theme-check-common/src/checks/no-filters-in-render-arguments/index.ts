import { NamedTags } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

const CHECKED_TAGS: string[] = [NamedTags.render, NamedTags.include, NamedTags.content_for];

/**
 * Finds the index of the first filter pipe (`|`) in a raw render/include/content_for
 * markup string that is *not* inside a quoted string literal. Returns -1 if none is
 * found.
 *
 * This is a heuristic on the raw markup because, when a `render`/`include`/`content_for`
 * tag contains a filter, the strict grammar refuses it and the parser falls back to
 * a base-case `LiquidTag` whose `markup` is a raw string (there is no structured
 * `RenderMarkup` node to inspect).
 */
function indexOfFilterPipe(markup: string): number {
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < markup.length; i++) {
    const char = markup[i];

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === '|') {
      return i;
    }
  }

  return -1;
}

export const NoFiltersInRenderArguments: LiquidCheckDefinition = {
  meta: {
    code: 'NoFiltersInRenderArguments',
    name: 'No Filters in Render Arguments',
    docs: {
      description:
        "This check warns against using filters on values passed as arguments to a 'render', 'include', or 'content_for' tag. " +
        'Filters are not applied in that position and the value is passed through unchanged, which silently ' +
        'produces incorrect output.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/no-filters-in-render-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (!CHECKED_TAGS.includes(node.name)) return;

        // When the tag parses successfully, `markup` is a structured
        // `RenderMarkup` object and filters are impossible. A raw string means
        // the strict parse failed (e.g. because of a filter pipe).
        if (typeof node.markup !== 'string') return;

        const relativePipeIndex = indexOfFilterPipe(node.markup);
        if (relativePipeIndex === -1) return;

        const markupStart = node.source.indexOf(node.markup, node.position.start);
        if (markupStart === -1) return;

        const startIndex = markupStart + relativePipeIndex;
        const endIndex = markupStart + node.markup.length;

        context.report({
          message:
            `Filters cannot be used on arguments passed to the '${node.name}' tag. ` +
            `Apply the filter beforehand (e.g. with {% assign %}) and pass the result instead.`,
          startIndex,
          endIndex,
        });
      },
    };
  },
};
