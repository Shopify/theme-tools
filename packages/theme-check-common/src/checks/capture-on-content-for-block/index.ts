import {
  LiquidTag,
  LiquidTagCapture,
  NamedTags,
  NodeTypes,
  Position,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isContentForBlock } from '../../utils/markup';
import { isNodeOfType } from '../utils';

function isLiquidTagCapture(node: LiquidTag): node is LiquidTagCapture {
  return node.name === 'capture' && typeof node.markup !== 'string';
}

export const CaptureOnContentForBlock: LiquidCheckDefinition = {
  meta: {
    code: 'CaptureOnContentForBlock',
    name: 'Do not capture `content_for "block"`',
    docs: {
      description:
        'Capture of content_for "block" is restricted to enforce static block rendering at its expected location.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/content_for_block',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    function checkContentForBlock(node: any, position: Position) {
      if (
        isNodeOfType(NodeTypes.LiquidTag, node) &&
        node.name === NamedTags.content_for &&
        isContentForBlock(node.markup)
      ) {
        context.report({
          message: 'Do not capture `content_for "block"`',
          startIndex: position.start,
          endIndex: position.end,
        });
      }
    }

    return {
      async LiquidTag(node) {
        if (isLiquidTagCapture(node) && node.children) {
          for (const child of node.children) {
            if (child.type === NodeTypes.LiquidTag) {
              checkContentForBlock(child, child.position);
            }
          }
        }
      },
      async LiquidVariableOutput(node) {
        if (typeof node.markup === 'string') return;

        if (node.markup.filters.length) {
          checkContentForBlock(node.markup.expression, node.position);
        }
      },
    };
  },
};
