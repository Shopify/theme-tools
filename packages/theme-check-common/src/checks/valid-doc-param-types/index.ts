import { TextNode } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getValidParamTypes, parseParamType, parseStringLiterals } from '../../liquid-doc/utils';

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
    const validParamTypesPromise = context.themeDocset
      ?.liquidDrops()
      .then((entries) => new Set(getValidParamTypes(entries).keys()));

    async function isSupportedParamType(type: string): Promise<boolean> {
      if (usesStringLiteralSyntax(type)) return parseStringLiterals(type) !== undefined;

      // Named types come from the docset, so they can only be checked with one.
      if (!validParamTypesPromise) return true;
      return parseParamType(await validParamTypesPromise, type) !== undefined;
    }

    return {
      async LiquidDocParamNode(node) {
        const { paramType } = node;
        if (!paramType || (await isSupportedParamType(paramType.value))) return;

        context.report({
          message: `The parameter type '${paramType.value}' is not supported.`,
          // Index is offset to include the curly brackets around the param type
          startIndex: paramType.position.start - 1,
          endIndex: paramType.position.end + 1,
          suggest: [
            {
              message: 'Remove invalid parameter type',
              fix: (corrector) => {
                const [start, end] = paramTypeRemovalRange(node.source, paramType);
                corrector.replace(start, end, ' ');
              },
            },
          ],
        });
      },
    };
  },
};

/**
 * Quotes and pipes only appear in string literal types, such as
 * `'heading' | 'small'`. Named types, such as `product[]`, never contain them.
 */
function usesStringLiteralSyntax(type: string): boolean {
  return /['"|]/.test(type);
}

/**
 * Returns the range that removing a parameter type replaces with one space:
 * the type, its braces, and the spaces and tabs around them. For example,
 * `@param  { bad }  [name]` becomes `@param [name]`.
 */
function paramTypeRemovalRange(source: string, paramType: TextNode): [start: number, end: number] {
  let start = paramType.position.start - 1;
  let end = paramType.position.end + 1;
  while (isSpaceOrTab(source.charAt(start - 1))) start--;
  while (isSpaceOrTab(source.charAt(end))) end++;
  return [start, end];
}

function isSpaceOrTab(char: string): boolean {
  return char === ' ' || char === '\t';
}
