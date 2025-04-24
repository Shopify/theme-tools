import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, RenderMarkup } from '@shopify/liquid-html-parser';
import { getSnippetName, reportDuplicateArguments } from '../../liquid-doc/arguments';

export const DuplicateRenderSnippetArguments: LiquidCheckDefinition = {
  meta: {
    code: 'DuplicateRenderSnippetArguments',
    name: 'Duplicate Render Snippet Arguments',
    aliases: ['DuplicateRenderSnippetParams'],
    docs: {
      description:
        'This check ensures that no duplicate argument names are provided when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/duplicate-render-snippet-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async RenderMarkup(node: RenderMarkup) {
        const snippetName = getSnippetName(node);

        if (!snippetName) return;

        const encounteredArgNames = new Set<string>();
        const duplicateArgs: LiquidNamedArgument[] = [];

        if (node.alias?.value) {
          encounteredArgNames.add(node.alias.value);
        }

        for (const param of node.args) {
          if (encounteredArgNames.has(param.name)) {
            duplicateArgs.push(param);
          }

          encounteredArgNames.add(param.name);
        }

        reportDuplicateArguments(context, node, duplicateArgs, snippetName);
      },
    };
  },
};
