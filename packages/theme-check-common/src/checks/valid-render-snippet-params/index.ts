import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, RenderMarkup } from '@shopify/liquid-html-parser';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { getSnippetDefinition, LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';
import { getDefaultValueForType } from '../../liquid-doc/utils';

export const ValidRenderSnippetParams: LiquidCheckDefinition = {
  meta: {
    code: 'ValidRenderSnippetParams',
    name: 'Valid Render Snippet Parameters',

    docs: {
      description:
        'This check ensures that all required parameters are provided when rendering a snippet and that no unknown parameters are used.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-render-snippet-params',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function partitionParameters(
      liquidDocParameters: Map<string, LiquidDocParameter>,
      providedParams: LiquidNamedArgument[],
    ) {
      const providedParameters = new Map(providedParams.map((arg) => [arg.name, arg]));

      const missingRequiredParams: LiquidDocParameter[] = [];
      const unknownProvidedParams: LiquidNamedArgument[] = [];

      // Check required params
      for (const param of liquidDocParameters.values()) {
        if (param.required && !providedParameters.has(param.name)) {
          missingRequiredParams.push(param);
        }
      }

      // Check provided params
      for (const arg of providedParameters.values()) {
        const liquidDocParamDef = liquidDocParameters.has(arg.name);
        if (!liquidDocParamDef) {
          unknownProvidedParams.push(arg);
        }
      }

      return {
        missingRequiredParams,
        unknownProvidedParams,
      };
    }

    function reportMissingParams(
      missingRequiredParams: LiquidDocParameter[],
      node: RenderMarkup,
      snippetName: string,
    ) {
      for (const param of missingRequiredParams) {
        context.report({
          message: `Missing required parameter '${param.name}' in render tag for snippet '${snippetName}'`,
          startIndex: node.position.start,
          endIndex: node.position.end,
          suggest: [
            {
              message: `Add required parameter '${param.name}'`,
              fix: (fixer) => {
                const paramToAdd = `, ${param.name}: ${getDefaultValueForType(param.type)}`;

                if (node.args.length == 0) {
                  return fixer.insert(node.snippet.position.end, paramToAdd);
                }

                const lastArg = node.args[node.args.length - 1];
                const sourceAfterLastArg = node.source.substring(
                  lastArg.position.end,
                  node.position.end,
                );

                const trailingCommaAndWhitespaceMatch = sourceAfterLastArg.match(/\s*,\s*/);
                if (trailingCommaAndWhitespaceMatch) {
                  // IF there is already a trailing comma after the last arg, we want to find it and replace it with our own while stripping whitespace
                  return fixer.replace(
                    lastArg.position.end,
                    lastArg.position.end + trailingCommaAndWhitespaceMatch[0].length,
                    `${paramToAdd} `,
                  );
                }

                return fixer.insert(lastArg.position.end, paramToAdd);
              },
            },
          ],
        });
      }
    }

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

    return {
      async RenderMarkup(node: RenderMarkup) {
        if (!isLiquidString(node.snippet) || node.variable) {
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

        const { missingRequiredParams, unknownProvidedParams } = partitionParameters(
          liquidDocParameters,
          node.args,
        );

        reportMissingParams(missingRequiredParams, node, snippetName);
        reportUnknownParams(unknownProvidedParams, node, snippetName);
      },
    };
  },
};
