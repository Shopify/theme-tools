import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { ContentForMarkup } from '@shopify/liquid-html-parser';
import {
  getBlockName,
  getLiquidDocParams,
  reportMissingArguments,
} from '../../liquid-doc/arguments';

export const MissingContentForArguments: LiquidCheckDefinition = {
  meta: {
    code: 'MissingContentForArguments',
    name: 'Missing ContentFor Arguments',
    docs: {
      description:
        'This check ensures that all required arguments are provided when rendering a static block.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-content-for-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async ContentForMarkup(node: ContentForMarkup) {
        const blockName = getBlockName(node);

        if (!blockName) return;

        const liquidDocParameters = await getLiquidDocParams(context, `blocks/${blockName}.liquid`);

        if (!liquidDocParameters) return;

        const providedParams = new Map(node.args.map((arg) => [arg.name, arg]));

        const missingRequiredParams = Array.from(liquidDocParameters.values()).filter(
          (p) => p.required && !providedParams.has(p.name),
        );

        reportMissingArguments(context, node, missingRequiredParams, blockName);
      },
    };
  },
};
