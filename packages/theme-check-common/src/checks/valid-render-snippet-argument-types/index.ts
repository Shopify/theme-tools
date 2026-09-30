import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { NodeTypes, RenderMarkup } from '@shopify/liquid-html-parser';
import { LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import {
  getArgumentTypeMismatchMessage,
  getValidParamTypes,
  isArgumentTypeCompatible,
  parseParamType,
} from '../../liquid-doc/utils';
import {
  findTypeMismatchParams,
  generateTypeMismatchSuggestions,
  getLiquidDocParams,
  getSnippetName,
  reportTypeMismatches,
} from '../../liquid-doc/arguments';

export const ValidRenderSnippetArgumentTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidRenderSnippetArgumentTypes',
    name: 'Valid Render Snippet Argument Types',
    aliases: ['ValidRenderSnippetParamTypes'],
    docs: {
      description:
        'This check ensures that arguments passed to snippet match the expected types defined in the liquidDoc header if present.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-render-snippet-argument-types',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    let validParamTypesPromise: Promise<Set<string>> | undefined;

    /**
     * Checks for type mismatches when alias is used with `for` or `with` syntax.
     * E.g. {% render 'card' with 123 as title %}
     */
    async function findAndReportAliasType(
      node: RenderMarkup,
      liquidDocParameters: Map<string, LiquidDocParameter>,
    ) {
      if (!node.alias || !node.variable?.name) return;

      const expectedType = liquidDocParameters.get(node.alias.value)?.type;
      const argument = node.variable.name;
      if (!expectedType || argument.type === NodeTypes.VariableLookup) return;

      const compatibility = isArgumentTypeCompatible(expectedType, argument);
      if (compatibility === true) return;

      if (compatibility === undefined) {
        // Aliases also check named Liquid types and arrays. Validate the
        // declaration first so malformed types do not cause a second error.
        if (!context.themeDocset) return;
        validParamTypesPromise ??= context.themeDocset
          .liquidDrops()
          .then((entries) => new Set(getValidParamTypes(entries).keys()));
        if (!parseParamType(await validParamTypesPromise, expectedType)) return;
      }

      context.report({
        message: getArgumentTypeMismatchMessage(node.alias.value, expectedType, argument),
        startIndex: argument.position.start,
        endIndex: argument.position.end,
        suggest: generateTypeMismatchSuggestions(
          expectedType,
          argument.position.start,
          argument.position.end,
        ),
      });
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

        await findAndReportAliasType(node, liquidDocParameters);

        const typeMismatchParams = findTypeMismatchParams(liquidDocParameters, node.args);
        reportTypeMismatches(context, typeMismatchParams, liquidDocParameters);
      },
    };
  },
};
