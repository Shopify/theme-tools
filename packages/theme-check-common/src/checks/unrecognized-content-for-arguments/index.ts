import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { ContentForMarkup } from '@shopify/liquid-html-parser';
import {
  getBlockName,
  getLiquidDocParams,
  reportUnknownArguments,
} from '../../liquid-doc/arguments';
import {
  CLOSEST_ARGUMENT,
  REQUIRED_CONTENT_FOR_ARGUMENTS,
  RESERVED_CONTENT_FOR_ARGUMENTS,
} from '../../tags/content-for';

export const UnrecognizedContentForArguments: LiquidCheckDefinition = {
  meta: {
    code: 'UnrecognizedContentForArguments',
    name: 'Unrecognized ContentFor Arguments',
    docs: {
      description:
        'This check ensures that no unknown arguments are used when rendering a static block.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-content-for-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const DEFAULT_CONTENT_FOR_ARGS = new Set([
      ...RESERVED_CONTENT_FOR_ARGUMENTS,
      ...REQUIRED_CONTENT_FOR_ARGUMENTS,
    ]);

    return {
      async ContentForMarkup(node: ContentForMarkup) {
        const blockName = getBlockName(node);

        if (!blockName) return;

        const liquidDocParameters = await getLiquidDocParams(context, `blocks/${blockName}.liquid`);

        if (!liquidDocParameters) return;

        const unknownProvidedParams = node.args
          .filter((p) => !liquidDocParameters.has(p.name))
          .filter((p) => !DEFAULT_CONTENT_FOR_ARGS.has(p.name))
          .filter((p) => !p.name.startsWith(CLOSEST_ARGUMENT));

        reportUnknownArguments(context, node, unknownProvidedParams, blockName);
      },
    };
  },
};
