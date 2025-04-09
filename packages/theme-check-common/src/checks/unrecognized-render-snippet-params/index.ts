import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, RenderMarkup } from '@shopify/liquid-html-parser';
import { getSnippetDefinition, LiquidDocParameter } from '../../liquid-doc/liquidDoc';
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
      if (node.alias && !liquidDocParameters.has(node.alias) && node.variable) {
        const asAliasMatch = node.source
          .slice(node.variable.position.end, node.position.end)
          .match(new RegExp(`\\s+as\\s+${node.alias}`));

        let endIndex = node.variable.position.end;
        let suggest = [];

        if (asAliasMatch) {
          // We drop the the position information for the node representing `as alias`, so we're manually calculating it here.
          // This brute-force approach can be simplified by changing the mapping in stage-1 and 2 to preserve this info, as it should already be parsed
          endIndex += asAliasMatch[0].length;
          suggest.push({
            message: `Remove '${node.alias}'`,
            fix: (fixer: any) => {
              if (node.variable) {
                return fixer.remove(
                  node.variable.position.start,
                  node.variable.position.end + asAliasMatch[0].length,
                );
              }
            },
          });
        }

        context.report({
          message: `Unknown parameter '${node.alias}' in render tag for snippet '${snippetName}'`,
          startIndex: node.variable.position.start,
          endIndex: endIndex,
          suggest,
        });
      }
    }

    return {
      async RenderMarkup(node: RenderMarkup) {
        if (!isLiquidString(node.snippet)) {
          return;
        }

        const snippetName = node.snippet.value;
        const snippetPath = `snippets/${snippetName}.liquid`;
        const snippetUri = context.toUri(snippetPath);

        const snippetDef = context.getDocDefinition && (await context.getDocDefinition(snippetUri));

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
