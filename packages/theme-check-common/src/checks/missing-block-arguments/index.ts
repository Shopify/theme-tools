import { BLOCK_CONTENT_PARAMETER } from '../../block-parameters';
import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import { blockTagSyntaxError } from '../liquid-syntax-error/block';
import type { BlockMarkup } from '@shopify/liquid-html-parser';

export const MissingBlockArguments: LiquidCheckDefinition = {
  meta: {
    code: 'MissingBlockArguments',
    name: 'Missing Block Arguments',
    docs: {
      description: 'Reports required LiquidDoc parameters not provided to a block tag.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-block-arguments',
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

        const providedParameters = new Set(markup.args.map((argument) => argument.name));
        if (node.children?.length) providedParameters.add(BLOCK_CONTENT_PARAMETER);

        for (const parameter of parameters.values()) {
          if (!parameter.required || providedParameters.has(parameter.name)) continue;

          context.report({
            message: `Missing required argument '${parameter.name}' in block tag for '${markup.name.value}'.`,
            startIndex: node.blockStartPosition.start,
            endIndex: node.blockStartPosition.end,
          });
        }
      },
    };
  },
};
