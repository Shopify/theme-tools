import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { RenderMarkup } from '@shopify/liquid-html-parser';
import {
  getLiquidDocParams,
  getSnippetName,
  reportMissingArguments,
} from '../../liquid-doc/arguments';

export const MissingRenderSnippetArguments: LiquidCheckDefinition = {
  meta: {
    code: 'MissingRenderSnippetArguments',
    name: 'Missing Render Snippet Arguments',
    aliases: ['MissingRenderSnippetParams'],
    docs: {
      description:
        'This check ensures that all required arguments are provided when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-render-snippet-arguments',
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

        const liquidDocParameters = await getLiquidDocParams(
          context,
          `snippets/${snippetName}.liquid`,
        );

        if (!liquidDocParameters) return;

        const providedParams = new Map(node.args.map((arg) => [arg.name, arg]));

        const missingRequiredParams = Array.from(liquidDocParameters.values()).filter(
          (p) => p.required && !providedParams.has(p.name) && p.name !== node.alias?.value,
        );

        reportMissingArguments(context, node, missingRequiredParams, snippetName);
      },
    };
  },
};
