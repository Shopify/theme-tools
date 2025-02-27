import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, NodeTypes, RenderMarkup } from '@shopify/liquid-html-parser';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { getSnippetDefinition, LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';

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
                // This is a bit messy, but it allows us to strip leading and trailing whitespaces and commas
                const sourceBeforeArg = node.source.slice(0, param.position.start);
                const matches = sourceBeforeArg.match(/,\s*/g);
                const lastWhitespaceMatch = matches ? matches[matches.length - 1] : null;
                let startPos = lastWhitespaceMatch
                  ? param.position.start - (lastWhitespaceMatch.length - 1)
                  : param.position.start;

                if (isLastParam(param)) {
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

      function isLastParam(param: LiquidNamedArgument): boolean {
        return (
          node.args.length == 1 ||
          param.position.start == node.args[node.args.length - 1].position.start
        );
      }
    }

    function reportUnknownAliases(
      node: RenderMarkup,
      liquidDocParameters: Map<string, LiquidDocParameter>,
      snippetName: string,
    ) {
      if (node.alias && !liquidDocParameters.has(node.alias) && node.variable) {
        const asAliasMatch = node.source.match(new RegExp(`as\\s+${node.alias}`));

        const suggest = asAliasMatch
          ? [
              {
                message: `Remove '${node.alias}'`,
                fix: (fixer: any) => {
                  if (node.variable) {
                    return fixer.remove(
                      node.variable.position.start,
                      node.source.indexOf(asAliasMatch[0]) + asAliasMatch[0].length,
                    );
                  }
                },
              },
            ]
          : [];

        context.report({
          message: `Unknown parameter '${node.alias}' in render tag for snippet '${snippetName}'`,
          startIndex: node.variable.position.start,
          endIndex: node.variable.position.end,
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

        const snippetContent = await context.fs.readFile(snippetUri);
        const snippetAst = toLiquidHtmlAST(snippetContent);
        const snippetDef = getSnippetDefinition(snippetAst, snippetName);

        if (!snippetDef.liquidDoc?.parameters) {
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
