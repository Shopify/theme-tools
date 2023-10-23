import { Doc, doc } from 'prettier';
import { isBranchedTag } from '@shopify/liquid-html-parser';
import { LiquidAstPath, LiquidHtmlNode, LiquidBranch } from '../../types';
import { isEmpty } from './array';

export * from './array';
export * from './string';
export * from './node';

const { builders } = doc;
const { ifBreak } = builders;

export function getSource(path: LiquidAstPath) {
  return path.getValue().source;
}

export function isDeeplyNested(
  node: Extract<LiquidHtmlNode, { children?: LiquidHtmlNode[] }>,
): boolean {
  if (!node.children) return false;
  if (isBranchedTag(node)) {
    return !!node.children.find((child) => isDeeplyNested(child as LiquidBranch));
  }
  return !!node.children.find((child) => !isEmpty((child as any).children || []));
}

// Optionally converts a '' into '-' if any of the parent group breaks and source[loc] is non space.
export function getWhitespaceTrim(
  currWhitespaceTrim: string,
  needsWhitespaceStrippingOnBreak: boolean | undefined,
  groupIds?: symbol | symbol[],
): Doc {
  return ifBreakChain(
    needsWhitespaceStrippingOnBreak ? '-' : currWhitespaceTrim,
    currWhitespaceTrim,
    Array.isArray(groupIds) ? groupIds : [groupIds],
  );
}

// Threads ifBreak into multiple sources of breakage (paragraph or self, etc.)
export const FORCE_FLAT_GROUP_ID = Symbol('force-no-break');
export const FORCE_BREAK_GROUP_ID = Symbol('force-break');

export function ifBreakChain(
  breaksContent: Doc,
  flatContent: Doc,
  groupIds: (symbol | undefined)[],
) {
  if (groupIds.includes(FORCE_BREAK_GROUP_ID)) return breaksContent;
  if (groupIds.includes(FORCE_FLAT_GROUP_ID)) return flatContent;
  return groupIds.reduce(
    (currFlatContent, groupId) => ifBreak(breaksContent, currFlatContent, { groupId }),
    flatContent,
  );
}

export function isNonEmptyArray(object: any): object is any[] {
  return Array.isArray(object) && object.length > 0;
}
