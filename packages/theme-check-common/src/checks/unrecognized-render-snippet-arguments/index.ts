import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { RenderMarkup } from '@shopify/liquid-html-parser';
import { LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import {
  getLiquidDocParams,
  getSnippetName,
  reportUnknownArguments,
} from '../../liquid-doc/arguments';

export const UnrecognizedRenderSnippetArguments: LiquidCheckDefinition = {
  meta: {
    code: 'UnrecognizedRenderSnippetArguments',
    name: 'Unrecognized Render Snippet Arguments',
    aliases: ['UnrecognizedRenderSnippetParams'],
    docs: {
      description:
        'This check ensures that no unknown arguments are used when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-render-snippet-arguments',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function reportUnknownAliases(
      node: RenderMarkup,
      liquidDocParameters: Map<string, LiquidDocParameter>,
      snippetName: string,
    ) {
      const alias = node.alias;
      const variable = node.variable;

      if (alias && !liquidDocParameters.has(alias.value) && variable) {
        const startIndex = variable.position.start + 1;

        context.report({
          message: `Unknown argument '${alias.value}' in render tag for snippet '${snippetName}'.`,
          startIndex: startIndex,
          endIndex: alias.position.end,
          suggest: [
            {
              message: `Remove '${alias.value}'`,
              fix: (fixer: any) => {
                if (variable) {
                  return fixer.remove(variable.position.start, alias.position.end);
                }
              },
            },
          ],
        });
      }
    }

    return {
      async RenderMarkup(node: RenderMarkup) {
        const snippetName = getSnippetName(node);

        if (!snippetName) return;

        const liquidDocParameters = await getLiquidDocParams(
          context,
          `snippets/${snippetName}.liquid`,
        );

        if (!liquidDocParameters) return;

        const unknownProvidedParams = node.args.filter((p) => !liquidDocParameters.has(p.name));
        reportUnknownAliases(node, liquidDocParameters, snippetName);
        reportUnknownArguments(context, node, unknownProvidedParams, snippetName);
      },
    };
  },
};
