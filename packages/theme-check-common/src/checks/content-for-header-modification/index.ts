import {
  LiquidTag,
  LiquidTagAssign,
  LiquidTagCapture,
  LiquidTagEcho,
  NodeTypes,
  Position,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isNodeOfType } from '../utils';

function isLiquidTagAssign(node: LiquidTag): node is LiquidTagAssign {
  return node.name === 'assign' && typeof node.markup !== 'string';
}
function isLiquidTagCapture(node: LiquidTag): node is LiquidTagCapture {
  return node.name === 'capture' && typeof node.markup !== 'string';
}
function isLiquidTagEcho(node: LiquidTag): node is LiquidTagEcho {
  return node.name === 'echo' && typeof node.markup !== 'string';
}

export const ContentForHeaderModification: LiquidCheckDefinition = {
  meta: {
    code: 'ContentForHeaderModification',
    name: 'Do not depend on the content of content_for_header',
    docs: {
      description:
        'Do not rely on the content of content_for_header as it might change in the future, which could cause your Liquid code behavior to change.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/content-for-header-modification',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    function checkContentForHeader(node: any, position: Position) {
      if (isNodeOfType(NodeTypes.VariableLookup, node) && node.name === 'content_for_header') {
        context.report({
          message: 'Do not rely on the content of `content_for_header`',
          startIndex: position.start,
          endIndex: position.end,
        });
      }
    }

    return {
      async LiquidTag(node) {
        if (isLiquidTagAssign(node)) {
          checkContentForHeader(node.markup.value.expression, node.position);
        } else if (isLiquidTagEcho(node)) {
          checkContentForHeader(node.markup.expression, node.position);
        } else if (isLiquidTagCapture(node) && node.children) {
          for (const child of node.children) {
            if (child.type === NodeTypes.LiquidVariableOutput && typeof child.markup !== 'string') {
              checkContentForHeader(child.markup.expression, child.position);
            }
          }
        }
      },
      async LiquidVariableOutput(node) {
        if (typeof node.markup === 'string') return;

        if (node.markup.filters.length) {
          checkContentForHeader(node.markup.expression, node.position);
        }
      },
    };
  },
};
