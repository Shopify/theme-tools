import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import type { BlockMarkup } from '@shopify/liquid-html-parser';
import { getBlockDocParams } from '../common/block-doc';

export const MissingBlockArguments: LiquidCheckDefinition = {
  meta: {
    code: 'MissingBlockArguments',
    name: 'Missing Block Arguments',
    docs: {
      description:
        "Reports when required arguments declared in a block's {% doc %} tag are not provided.",
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
        if (typeof node.markup === 'string') return;

        const markup = node.markup as BlockMarkup;
        const blockName = markup.name.value;
        const docParams = await getBlockDocParams(context, blockName);
        if (!docParams) return;

        const providedParams = new Set(markup.args.map((arg) => arg.name));

        for (const [paramName, param] of docParams) {
          if (!param.required) continue;
          if (providedParams.has(paramName)) continue;

          context.report({
            message: `Missing required argument '${paramName}' in block tag for '${blockName}'.`,
            startIndex: node.position.start,
            endIndex: node.position.end,
          });
        }
      },
    };
  },
};
