import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getValidParamTypes, parseParamType, parseStringEnumType } from '../../liquid-doc/utils';

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

    // Enum declarations do not need the object catalog. Load it once, on demand,
    // when checking a named type.
    let validParamTypesPromise: Promise<Set<string>> | undefined;

    return {
      async LiquidDocParamNode(node) {
        if (!node.paramType) {
          return;
        }

        if (parseStringEnumType(node.paramType.value)) return;

        validParamTypesPromise ??= context
          .themeDocset!.liquidDrops()
          .then((entries) => new Set(getValidParamTypes(entries).keys()));
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

                let start = node.paramType.position.start - 1;
                let end = node.paramType.position.end + 1;
                while (/[ \t]/.test(node.source.charAt(start - 1))) start--;
                while (/[ \t]/.test(node.source.charAt(end))) end++;
                corrector.replace(start, end, ' ');
              },
            },
          ],
        });
      },
    };
  },
};
