import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { RenderMarkup } from '@shopify/liquid-html-parser';
import { LiquidDocParameter } from '../../liquid-doc/liquidDoc';
import {
  ArgumentTypeCheck,
  checkArgumentType,
  getArgumentTypeMismatchMessage,
  getValidParamTypes,
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
      if (!expectedType) return;

      const argument = node.variable.name;
      if (!(await isAliasMismatch(expectedType, checkArgumentType(expectedType, argument)))) return;

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

    /**
     * Aliases check literals against every declared type, including named types
     * and arrays, which no literal matches. With a docset, types that it does not
     * define are left to ValidDocParamTypes so each declaration is reported once.
     * The docset lookup uses the declared spelling, as ValidDocParamTypes does,
     * so `Product` is reported only as an unsupported type.
     */
    async function isAliasMismatch(
      expectedType: string,
      check: ArgumentTypeCheck,
    ): Promise<boolean> {
      switch (check.kind) {
        case 'incompatible':
          return true;
        case 'named-type':
          if (!context.themeDocset) return true;
          validParamTypesPromise ??= context.themeDocset
            .liquidDrops()
            .then((entries) => new Set(getValidParamTypes(entries).keys()));
          return parseParamType(await validParamTypesPromise, expectedType) !== undefined;
        case 'compatible':
        case 'unchecked':
          return false;
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

        await findAndReportAliasType(node, liquidDocParameters);

        const typeMismatchParams = findTypeMismatchParams(liquidDocParameters, node.args);
        reportTypeMismatches(context, typeMismatchParams, liquidDocParameters);
      },
    };
  },
};
