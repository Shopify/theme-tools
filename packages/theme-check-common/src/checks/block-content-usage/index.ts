import { LiquidVariableLookup, NodeTypes } from '@shopify/liquid-html-parser';
import { BLOCK_CONTENT_PARAMETER } from '../../block-parameters';
import { isBlock } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isWithinRawTagThatDoesNotParseItsContents } from '../utils';

const MESSAGE = "Use the implicit 'content' parameter directly instead of 'block.content'.";

export const BlockContentUsage: LiquidCheckDefinition = {
  meta: {
    code: 'BlockContentUsage',
    name: 'Use `content` instead of `block.content`',
    docs: {
      description:
        "Reports 'block.content' in theme block files, where the built-in 'content' parameter is available as the 'content' variable.",
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/block-content-usage',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!isBlock(context.file.uri)) return {};

    return {
      // BAD: {{ block.content }}
      // BAD: {{ block['content'] | upcase }}
      // GOOD: {{ content }}
      async VariableLookup(node, ancestors) {
        if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;
        if (!isBlockContentLookup(node)) return;

        context.report({
          message: MESSAGE,
          startIndex: node.position.start,
          endIndex: node.position.end,
        });
      },
    };
  },
};

function isBlockContentLookup(node: LiquidVariableLookup): boolean {
  const [firstLookup] = node.lookups;
  return (
    node.name === 'block' &&
    firstLookup?.type === NodeTypes.String &&
    firstLookup.value === BLOCK_CONTENT_PARAMETER
  );
}
