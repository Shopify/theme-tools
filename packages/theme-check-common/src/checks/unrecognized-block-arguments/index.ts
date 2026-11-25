import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import { blockTagSyntaxError } from '../liquid-syntax-error/block';
import type { BlockMarkup } from '@shopify/liquid-html-parser';

export const UnrecognizedBlockArguments: LiquidCheckDefinition = {
  meta: {
    code: 'UnrecognizedBlockArguments',
    name: 'Unrecognized Block Arguments',
    docs: {
      description:
        "Reports arguments in a block tag that are not part of the block's merged schema, LiquidDoc, and content interface.",
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-block-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name !== 'block') return;
        if (blockTagSyntaxError(node)) return;

        const markup = node.markup as BlockMarkup;
        const parameters = await context.getBlockParameters(markup.name.value);
        if (!parameters) return;

        for (const argument of markup.args) {
          if (argument.name === 'block.name' || parameters.has(argument.name)) continue;

          context.report({
            message: `Unknown argument '${argument.name}' in block tag for '${markup.name.value}'.`,
            startIndex: argument.position.start,
            endIndex: argument.position.end,
          });
        }
      },
    };
  },
};
