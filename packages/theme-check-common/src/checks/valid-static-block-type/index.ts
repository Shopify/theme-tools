import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { doesFileExist } from '../../utils/file-utils';
import { isContentForBlock } from '../../utils/markup';

export const ValidStaticBlockType: LiquidCheckDefinition = {
  meta: {
    code: 'ValidStaticBlockType',
    name: 'Prevent use of type that is not valid for static blocks',
    docs: {
      description:
        'This check is aimed at preventing the use of an invalid type for blocks rendered statically.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-static-block-type',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (node.name !== 'content_for') {
          return;
        }

        if (!isContentForBlock(node.markup)) {
          return;
        }

        const typeArg = node.markup.args.find((arg) => arg.name === 'type');
        if (!typeArg) {
          return; // covered by VariableContentForArguments
        }

        const typeArgValueNode = typeArg.value;
        if (typeArgValueNode.type !== NodeTypes.String) {
          return; // covered by VariableContentForArguments
        }

        const blockName = typeArgValueNode.value;
        const relativePath = `blocks/${blockName}.liquid`;
        const fileExists = await doesFileExist(context, relativePath);

        if (!fileExists) {
          context.report({
            message: `'blocks/${blockName}.liquid' does not exist`,
            startIndex: typeArgValueNode.position.start,
            endIndex: typeArgValueNode.position.end,
            suggest: [],
          });
        }
      },
    };
  },
};
