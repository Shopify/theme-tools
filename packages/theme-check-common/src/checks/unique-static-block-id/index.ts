import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import {
  REQUIRED_CONTENT_FOR_ARGUMENTS,
  RESERVED_CONTENT_FOR_ARGUMENTS,
} from '../../tags/content-for';
import { isContentForBlock } from '../../utils/markup';

const FRAMEWORK_ARGS = new Set([
  ...REQUIRED_CONTENT_FOR_ARGUMENTS,
  ...RESERVED_CONTENT_FOR_ARGUMENTS,
]);

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
    const usedCompositeKeys: Set<string> = new Set();
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

        const idValue = idValueNode.value;

        const arbitraryArgs = node.markup.args.filter((arg) => !FRAMEWORK_ARGS.has(arg.name));

        const argParts: string[] = [];
        for (const arg of arbitraryArgs) {
          if (arg.value.type !== NodeTypes.String) {
            return;
          }
          argParts.push(`${arg.name}=${arg.value.value}`);
        }
        argParts.sort();
        const argsSuffix = argParts.join(',');

        const compositeKey = `${idValue}::${argsSuffix}`;

        if (usedCompositeKeys.has(compositeKey)) {
          context.report({
            message: `The id '${idValue}' is already being used by another static block`,
            startIndex: idValueNode.position.start,
            endIndex: idValueNode.position.end,
            suggest: [],
          });
        } else {
          usedCompositeKeys.add(compositeKey);
        }
      },
    };
  },
};
