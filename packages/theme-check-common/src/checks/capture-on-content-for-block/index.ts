import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isNodeOfType } from '../utils';

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
    return {
      async LiquidTag(node, ancestors) {
        if (node.name !== NamedTags.content_for) return;
        if (typeof node.markup === 'string') return;
        if (node.markup.contentForType.value !== 'block') return;

        for (const parentNode of ancestors) {
          if (
            isNodeOfType(NodeTypes.LiquidTag, parentNode) &&
            parentNode.name === NamedTags.capture
          ) {
            context.report({
              message: 'Do not capture `content_for "block"`',
              startIndex: node.position.start,
              endIndex: node.position.end,
            });
          }
        }
      },
    };
  },
};
