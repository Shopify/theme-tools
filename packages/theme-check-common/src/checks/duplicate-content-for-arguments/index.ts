import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { ContentForMarkup, LiquidNamedArgument } from '@shopify/liquid-html-parser';
import { getBlockName, reportDuplicateArguments } from '../../liquid-doc/arguments';

export const DuplicateContentForArguments: LiquidCheckDefinition = {
  meta: {
    code: 'DuplicateContentForArguments',
    name: 'Duplicate ContentFor Arguments',
    docs: {
      description:
        'This check ensures that no duplicate argument names are provided when rendering a static block.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-content-for-arguments',
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

        const encounteredArgNames = new Set<string>();
        const duplicateArgs: LiquidNamedArgument[] = [];

        for (const param of node.args) {
          if (encounteredArgNames.has(param.name)) {
            duplicateArgs.push(param);
          }

          encounteredArgNames.add(param.name);
        }

        reportDuplicateArguments(context, node, duplicateArgs, blockName);
      },
    };
  },
};
