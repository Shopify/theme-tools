import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, RenderMarkup } from '@shopify/liquid-html-parser';
import { LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';
import { isLastParam } from '../duplicate-render-snippet-params';

export const UnrecognizedRenderSnippetParams: LiquidCheckDefinition = {
  meta: {
    code: 'UnrecognizedRenderSnippetParams',
    name: 'Unrecognized Render Snippet Parameters',
    docs: {
      description:
        'This check ensures that no unknown parameters are used when rendering a snippet.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-render-snippet-params',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function reportUnknownParams(
      unknownProvidedParams: LiquidNamedArgument[],
      node: RenderMarkup,
      snippetName: string,
    ) {
      for (const param of unknownProvidedParams) {
        context.report({
          message: `Unknown parameter '${param.name}' in render tag for snippet '${snippetName}'`,
          startIndex: param.position.start,
          endIndex: param.position.end,
          suggest: [
            {
              message: `Remove '${param.name}'`,
              fix: (fixer) => {
                // This parameter removal logic is duplicated in DuplicateRenderSnippetParams
                // Consider extracting to a shared utility or simplifying the removal approach in the parsing steps.
                // I chose not to do so here as I would like more examples to see how this should be done.
                const sourceBeforeArg = node.source.slice(
                  node.position.start,
                  param.position.start,
                );
                const matches = sourceBeforeArg.match(/,\s*/g);
                const lastCommaMatch = matches?.[matches.length - 1];
                let startPos = lastCommaMatch
                  ? param.position.start - (lastCommaMatch.length - 1)
                  : param.position.start;

                if (isLastParam(node, param)) {
                  // Remove the leading comma if it's the last parameter
                  startPos -= 1;
                }

                const sourceAfterArg = node.source.substring(param.position.end, node.position.end);
                const trailingCommaMatch = sourceAfterArg.match(/\s*,/);
                if (trailingCommaMatch) {
                  return fixer.remove(startPos, param.position.end + trailingCommaMatch[0].length);
                }
                return fixer.remove(startPos, param.position.end);
              },
            },
          ],
        });
      }
    }

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
          message: `Unknown parameter '${alias.value}' in render tag for snippet '${snippetName}'`,
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
        if (!isLiquidString(node.snippet)) {
          return;
        }

        const snippetName = node.snippet.value;
        const snippetDef =
          context.getDocDefinition &&
          (await context.getDocDefinition(`snippets/${snippetName}.liquid`));

        if (!snippetDef?.liquidDoc?.parameters) {
          return;
        }

        const liquidDocParameters = new Map(
          snippetDef.liquidDoc.parameters.map((p) => [p.name, p]),
        );

        const unknownProvidedParams = node.args.filter((p) => !liquidDocParameters.has(p.name));
        reportUnknownAliases(node, liquidDocParameters, snippetName);
        reportUnknownParams(unknownProvidedParams, node, snippetName);
      },
    };
  },
};
