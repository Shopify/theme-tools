import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getValidParamTypes, parseParamType } from '../../liquid-doc/utils';

export const ValidDocParamTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidDocParamTypes',
    name: 'Valid doc parameter types',
    docs: {
      description:
        'This check exists to ensure any parameter types defined in the `doc` tag are valid.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-doc-param-types',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!context.themeDocset) {
      return {};
    }

    // To avoid recalculating valid param types during theme-check, constructing
    // the promise beforehand.
    const validParamTypesPromise = context
      .themeDocset!.liquidDrops()
      .then((entries) => new Set(getValidParamTypes(entries).keys()));

    return {
      async LiquidDocParamNode(node) {
        if (!node.paramType) {
          return;
        }

        const parsedParamType = parseParamType(await validParamTypesPromise, node.paramType.value);

        if (parsedParamType) {
          return;
        }

        context.report({
          message: `The parameter type '${node.paramType.value}' is not supported.`,
          // Index is offset to include the curly brackets around the param type
          startIndex: node.paramType.position.start - 1,
          endIndex: node.paramType.position.end + 1,
          suggest: [
            {
              message: 'Remove invalid parameter type',
              fix: (corrector) => {
                if (!node.paramType) return;

                corrector.replace(
                  node.position.start,
                  node.position.end,
                  node.source.slice(node.position.start, node.position.end).replace(
                    // We could have padded spaces around + inside the param type
                    // e.g. `{ string }`, `{string}`, or ` { string } `
                    /\s*\{\s*[^\s]+\s*\}\s*/,
                    ' ',
                  ),
                );
              },
            },
          ],
        });
      },
    };
  },
};
