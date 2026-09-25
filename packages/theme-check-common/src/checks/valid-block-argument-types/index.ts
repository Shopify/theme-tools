import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import {
  getArgumentTypeMismatchMessage,
  inferArgumentType,
  isArgumentTypeCompatible,
  parseStringEnumType,
} from '../../liquid-doc/utils';
import { generateTypeMismatchSuggestions } from '../../liquid-doc/arguments';
import { type BlockMarkup } from '@shopify/liquid-html-parser';
import { getBlockDocParams, isSystemArg } from '../common/block-doc';

export const ValidBlockArgumentTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockArgumentTypes',
    name: 'Valid Block Argument Types',
    docs: {
      description:
        'Reports type mismatches between block tag arguments and their {% doc %} declarations.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-argument-types',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name !== 'block') return;
        if (typeof node.markup === 'string') return;

        const markup = node.markup as BlockMarkup;
        const blockName = markup.name.value;
        const docParams = await getBlockDocParams(context, blockName);
        if (!docParams) return;

        for (const arg of markup.args) {
          if (isSystemArg(arg.name)) continue;
          const param = docParams.get(arg.name);
          if (!param || !param.type) continue;

          if (isArgumentTypeCompatible(param.type, arg.value) !== false) continue;

          const isEnum = !!parseStringEnumType(param.type);

          context.report({
            message:
              isEnum || arg.value.type === 'BlockArrayLiteral'
                ? getArgumentTypeMismatchMessage(arg.name, param.type, arg.value)
                : `Type mismatch for argument '${arg.name}': expected ${
                    param.type
                  }, got ${inferArgumentType(arg.value)}`,
            startIndex: arg.value.position.start,
            endIndex: arg.value.position.end,
            ...(isEnum && {
              suggest: generateTypeMismatchSuggestions(
                param.type,
                arg.value.position.start,
                arg.value.position.end,
              ),
            }),
          });
        }
      },
    };
  },
};
