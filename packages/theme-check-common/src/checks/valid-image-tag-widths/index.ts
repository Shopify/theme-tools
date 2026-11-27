import { LiquidFilter, LiquidNamedArgument, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isNodeOfType } from '../utils';

function namedArgument(filter: LiquidFilter, name: string): LiquidNamedArgument | undefined {
  return filter.args.find(
    (arg): arg is LiquidNamedArgument =>
      isNodeOfType(NodeTypes.NamedArgument, arg) && arg.name === name,
  );
}

/** The `width:` of an `image_url` filter, when it's a number literal. */
function imageUrlWidth(filter: LiquidFilter): number | undefined {
  const width = namedArgument(filter, 'width');
  if (!width || !isNodeOfType(NodeTypes.Number, width.value)) return undefined;
  const value = Number(width.value.value);
  return Number.isFinite(value) ? value : undefined;
}

/** The largest number in the `widths:` string of an `image_tag` filter. */
function largestImageTagWidth(widths: LiquidNamedArgument): number | undefined {
  if (!isNodeOfType(NodeTypes.String, widths.value)) return undefined;
  const values = widths.value.value
    .split(',')
    .map((width) => width.trim())
    .filter((width) => /^\d+(\.\d+)?$/.test(width))
    .map(Number);
  return values.length > 0 ? Math.max(...values) : undefined;
}

export const ValidImageTagWidths: LiquidCheckDefinition = {
  meta: {
    code: 'ValidImageTagWidths',
    name: 'Valid image_tag widths',
    docs: {
      description:
        "This check warns when the image_tag filter's widths go beyond the width requested by the image_url filter before it. " +
        'image_tag cannot serve images wider than the image_url width, so the larger widths in the srcset never get a bigger image.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-image-tag-widths',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidVariable(node) {
        let urlWidth: number | undefined;

        for (const filter of node.filters) {
          if (filter.name === 'image_url') {
            urlWidth = imageUrlWidth(filter);
            continue;
          }

          if (filter.name !== 'image_tag' || urlWidth === undefined) continue;

          const widths = namedArgument(filter, 'widths');
          if (!widths) continue;

          const largestWidth = largestImageTagWidth(widths);
          if (largestWidth === undefined || largestWidth <= urlWidth) continue;

          context.report({
            message:
              `The image_tag widths go up to ${largestWidth}, but the image_url width is ${urlWidth}. ` +
              `image_tag can't serve images wider than ${urlWidth}px, so raise the image_url width to at least ${largestWidth}.`,
            startIndex: widths.position.start,
            endIndex: widths.position.end,
          });
        }
      },
    };
  },
};
