import { BLOCK_CONTENT_PARAMETER } from '../../block-parameters';
import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import { blockTagSyntaxError } from '../liquid-syntax-error/block';
import type { BlockMarkup } from '@shopify/liquid-html-parser';

export const DuplicateBlockArguments: LiquidCheckDefinition = {
  meta: {
    code: 'DuplicateBlockArguments',
    name: 'Duplicate Block Arguments',
    docs: {
      description:
        'Reports duplicate block arguments and explicit content arguments overridden by inline body content.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-block-arguments',
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
        const seen = new Set<string>();
        const bodyOverridesContent = !!node.children?.length;

        for (const argument of markup.args) {
          const isDuplicate = seen.has(argument.name);
          seen.add(argument.name);

          if (isDuplicate) {
            context.report({
              message: `Duplicate argument '${argument.name}' in block tag for '${markup.name.value}'.`,
              startIndex: argument.position.start,
              endIndex: argument.position.end,
            });
          }

          if (!bodyOverridesContent || argument.name !== BLOCK_CONTENT_PARAMETER) continue;

          context.report({
            message: `The explicit 'content' argument has no effect because the inline block body takes precedence.`,
            startIndex: argument.position.start,
            endIndex: argument.position.end,
          });
        }
      },
    };
  },
};
