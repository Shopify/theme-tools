import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isContentForBlock } from '../../utils/markup';

export const UniqueStaticBlockId: LiquidCheckDefinition = {
  meta: {
    code: 'UniqueStaticBlockId',
    name: 'Prevent use of duplicated ids for blocks rendered statically',
    docs: {
      description:
        'This check is aimed at preventing the use of duplicated ids for blocks rendered statically.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unique-static-block-id',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const usedIds: Set<string> = new Set();
    const idRegex = /id:\s*["'](\S+)["']/;
    return {
      async LiquidTag(node) {
        if (node.name !== NamedTags.content_for) {
          return;
        }

        if (!isContentForBlock(node.markup)) {
          return;
        }

        const idNode = node.markup.args.find((arg) => arg.name === 'id');

        if (!idNode) {
          return; // covered by VariableContentForArguments
        }

        const idValueNode = idNode.value;
        if (idValueNode.type !== NodeTypes.String) {
          return; // covered by VariableContentForArguments
        }

        const id = idValueNode.value;

        if (usedIds.has(id)) {
          context.report({
            message: `The id '${id}' is already being used by another static block`,
            startIndex: idValueNode.position.start,
            endIndex: idValueNode.position.end,
            suggest: [],
          });
        } else {
          usedIds.add(id);
        }
      },
    };
  },
};
