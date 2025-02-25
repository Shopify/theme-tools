import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, NodeTypes, RenderMarkup } from '@shopify/liquid-html-parser';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { getSnippetDefinition, LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';
import {
  inferArgumentType,
  getDefaultValueForType,
  SupportedParamTypes,
  isTypeCompatible,
} from '../../liquid-doc/utils';

export const ValidRenderSnippetParamTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidRenderSnippetParamTypes',
    name: 'Valid Render Snippet Parameter Types',

    docs: {
      description:
        'This check ensures that parameters passed to snippet match the expected types defined in the liquidDoc header if present.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-render-snippet-param-types',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function findTypeMismatchParams(
      liquidDocParameters: Map<string, LiquidDocParameter>,
      providedParams: LiquidNamedArgument[],
    ) {
      const typeMismatchParams: LiquidNamedArgument[] = [];

      for (const arg of providedParams) {
        if (arg.value.type === NodeTypes.VariableLookup) {
          continue;
        }

        const liquidDocParamDef = liquidDocParameters.get(arg.name);
        if (liquidDocParamDef && liquidDocParamDef.type) {
          const paramType = liquidDocParamDef.type.toLowerCase();
          const supportedTypes = Object.keys(SupportedParamTypes).map((type) => type.toLowerCase());
          if (!supportedTypes.includes(paramType)) {
            continue;
          }

          if (!isTypeCompatible(paramType, inferArgumentType(arg))) {
            typeMismatchParams.push(arg);
          }
        }
      }

      return typeMismatchParams;
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
              message: `Replace with default value '${getDefaultValueForType(
                expectedType,
              )}' for ${expectedType}`,
              fix: (fixer) => {
                return fixer.replace(
                  arg.value.position.start,
                  arg.value.position.end,
                  getDefaultValueForType(expectedType),
                );
              },
            },
            {
              message: `Remove value`,
              fix: (fixer) => {
                return fixer.remove(arg.value.position.start, arg.value.position.end);
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

        const typeMismatchParams = findTypeMismatchParams(liquidDocParameters, node.args);
        reportTypeMismatches(typeMismatchParams, liquidDocParameters);
      },
    };
  },
};
