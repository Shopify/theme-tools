import { NodeTypes, type LiquidTag } from '@shopify/liquid-html-parser';
import type { Context } from '.';
import { hasBareArrayAccess, hasSkippedCharacters, rawMarkup } from './utils';

export function checkIncrementTag(node: LiquidTag, context: Context): void {
  if (typeof node.markup === 'string') {
    context.report({
      message: `Syntax error in 'increment' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
    return;
  }

  if (hasIncrementBareArrayAccess(node) || hasSkippedCharacters(rawMarkup(node))) {
    context.report({
      message: `Syntax error in 'increment' tag`,
      startIndex: node.position.start,
      endIndex: node.position.end,
    });
  }
}

function hasIncrementBareArrayAccess(node: LiquidTag): boolean {
  if (
    !node.markup ||
    typeof node.markup !== 'object' ||
    Array.isArray(node.markup) ||
    !('type' in node.markup)
  ) {
    return false;
  }

  return node.markup.type === NodeTypes.VariableLookup && hasBareArrayAccess(node.markup);
}
