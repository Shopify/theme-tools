import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { LiquidNamedArgument, NodeTypes, RenderMarkup } from '@shopify/liquid-html-parser';
import { LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import { isLiquidString } from '../utils';
import {
  inferArgumentType,
  getDefaultValueForType,
  BasicParamTypes,
  isTypeCompatible,
} from '../../liquid-doc/utils';
import { StringCorrector } from '../../fixes';

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
    /**
     * Generates suggestions for type mismatches based on the expected type and node positions
     */
    function generateTypeMismatchSuggestions(
      expectedType: string,
      startPosition: number,
      endPosition: number,
    ) {
      const defaultValue = getDefaultValueForType(expectedType);
      const suggestions = [];

      // Only add the "replace with default" suggestion if the default is not an empty string
      if (defaultValue !== '') {
        suggestions.push({
          message: `Replace with default value '${defaultValue}' for ${expectedType}`,
          fix: (fixer: StringCorrector) => {
            return fixer.replace(startPosition, endPosition, defaultValue);
          },
        });
      }

      // Always include the "remove value" suggestion
      suggestions.push({
        message: `Remove value`,
        fix: (fixer: StringCorrector) => {
          return fixer.remove(startPosition, endPosition);
        },
      });

      return suggestions;
    }

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
          const supportedTypes = Object.keys(BasicParamTypes).map((type) => type.toLowerCase());
          if (!supportedTypes.includes(paramType)) {
            continue;
          }

          if (!isTypeCompatible(paramType, inferArgumentType(arg.value))) {
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
        const actualType = inferArgumentType(arg.value);

        const suggestions = generateTypeMismatchSuggestions(
          expectedType,
          arg.value.position.start,
          arg.value.position.end,
        );

        context.report({
          message: `Type mismatch for parameter '${arg.name}': expected ${expectedType}, got ${actualType}`,
          startIndex: arg.value.position.start,
          endIndex: arg.value.position.end,
          suggest: suggestions,
        });
      }
    }

    /**
     * Checks for type mismatches when alias is used with `for` or `with` syntax.
     * This can be refactored at a later date to share more code with regular named arguments as they are both backed by LiquidExpression nodes.
     *
     * E.g. {% render 'card' with 123 as title %}
     */
    function findAndReportAliasType(
      node: RenderMarkup,
      liquidDocParameters: Map<string, LiquidDocParameter>,
    ) {
      if (
        node.alias &&
        node.variable?.name &&
        node.variable.name.type !== NodeTypes.VariableLookup
      ) {
        const paramIsDefinedWithType = liquidDocParameters
          .get(node.alias.value)
          ?.type?.toLowerCase();
        if (paramIsDefinedWithType) {
          const providedParamType = inferArgumentType(node.variable.name);
          if (!isTypeCompatible(paramIsDefinedWithType, providedParamType)) {
            const suggestions = generateTypeMismatchSuggestions(
              paramIsDefinedWithType,
              node.variable.name.position.start,
              node.variable.name.position.end,
            );

            context.report({
              message: `Type mismatch for parameter '${node.alias.value}': expected ${paramIsDefinedWithType}, got ${providedParamType}`,
              startIndex: node.variable.name.position.start,
              endIndex: node.variable.name.position.end,
              suggest: suggestions,
            });
          }
        }
      }
    }

    return {
      async RenderMarkup(node: RenderMarkup) {
        if (!isLiquidString(node.snippet)) {
          return;
        }

        const snippetName = node.snippet.value;
        const snippetPath = `snippets/${snippetName}.liquid`;
        const snippetDef =
          context.getDocDefinition && (await context.getDocDefinition(snippetPath));

        if (!snippetDef?.liquidDoc?.parameters) {
          return;
        }

        const liquidDocParameters = new Map(
          snippetDef.liquidDoc.parameters.map((p) => [p.name, p]),
        );

        findAndReportAliasType(node, liquidDocParameters);

        const typeMismatchParams = findTypeMismatchParams(liquidDocParameters, node.args);
        reportTypeMismatches(typeMismatchParams, liquidDocParameters);
      },
    };
  },
};
