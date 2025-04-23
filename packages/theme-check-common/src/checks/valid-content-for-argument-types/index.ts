import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { ContentForMarkup } from '@shopify/liquid-html-parser';
import {
  findTypeMismatchParams,
  getBlockName,
  getLiquidDocParams,
  reportTypeMismatches,
} from '../../liquid-doc/arguments';

export const ValidContentForArgumentTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidContentForArgumentTypes',
    name: 'Valid ContentFor Argument Types',
    docs: {
      description:
        'This check ensures that arguments passed to static blocks match the expected types defined in the liquidDoc header if present.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-content-for-argument-types',
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

        const typeMismatchParams = findTypeMismatchParams(liquidDocParameters, node.args);
        reportTypeMismatches(context, typeMismatchParams, liquidDocParameters);
      },
    };
  },
};
