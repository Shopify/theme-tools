import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, RenderMarkup } from '@shopify/liquid-html-parser';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { getSnippetDefinition, LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';
import { inferArgumentType, getDefaultValueForType } from '../../liquid-doc/utils';
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
      const typeMismatchParams: LiquidNamedArgument[] = [];

      // Check required params
      for (const param of liquidDocParameters.values()) {
        if (param.required && !providedParameters.has(param.name)) {
          missingRequiredParams.push(param);
        }
      }

      // Check provided params
      for (const arg of providedParameters.values()) {
        const liquidDocParamDef = liquidDocParameters.get(arg.name);
        if (!liquidDocParamDef) {
          unknownProvidedParams.push(arg);
        } else {
          const inferredType = inferArgumentType(arg);
          if (inferredType !== liquidDocParamDef.type?.toLowerCase()) {
            typeMismatchParams.push(arg);
          }
        }
      }

      return {
        missingRequiredParams,
        unknownProvidedParams,
        typeMismatchParams,
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
                let insertPosition = node.args.at(-1)?.position?.end ?? node.snippet.position.end;
                return fixer.insert(
                  insertPosition,
                  `, ${param.name}: ${getDefaultValueForType(param.type)}`,
                );
              },
            },
          ],
        });
      }
    }

    function reportUnknownParams(
      unknownProvidedParams: LiquidNamedArgument[],
      snippetName: string,
    ) {
      for (const arg of unknownProvidedParams) {
        context.report({
          message: `Unknown parameter '${arg.name}' in render tag for snippet '${snippetName}'`,
          startIndex: arg.position.start,
          endIndex: arg.position.end,
          suggest: [
            {
              message: `Remove '${arg.name}'`,
              fix: (fixer) => {
                return fixer.remove(arg.position.start, arg.position.end);
              },
            },
          ],
        });
      }
    }

    function reportTypeMismatches(
      typeMismatchParams: LiquidNamedArgument[],
      liquidDocParameters: Map<string, LiquidDocParameter>,
    ) {
      for (const arg of typeMismatchParams) {
        const paramDef = liquidDocParameters.get(arg.name);
        if (!paramDef || !paramDef.type) continue;

        const expectedType = paramDef.type.toLowerCase();
        const actualType = inferArgumentType(arg);

        context.report({
          message: `Type mismatch for parameter '${arg.name}': expected ${expectedType}, got ${actualType}`,
          startIndex: arg.value.position.start,
          endIndex: arg.value.position.end,
          suggest: [
            {
              message: `Convert to ${expectedType}`,
              fix: (fixer) => {
                return fixer.replace(
                  arg.value.position.start,
                  arg.value.position.end,
                  getDefaultValueForType(expectedType),
                );
              },
            },
          ],
        });
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

        const { missingRequiredParams, unknownProvidedParams, typeMismatchParams } =
          partitionParameters(liquidDocParameters, node.args);

        reportMissingParams(missingRequiredParams, node, snippetName);
        reportUnknownParams(unknownProvidedParams, snippetName);
        reportTypeMismatches(typeMismatchParams, liquidDocParameters);
      },
    };
  },
};
