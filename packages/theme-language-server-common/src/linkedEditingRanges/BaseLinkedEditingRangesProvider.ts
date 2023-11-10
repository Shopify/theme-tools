import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { LinkedEditingRangeParams, LinkedEditingRanges } from 'vscode-languageserver';

export interface BaseLinkedEditingRangesProvider {
  linkedEditingRanges: (
    node: LiquidHtmlNode | null,
    ancestors: LiquidHtmlNode[] | null,
    params: LinkedEditingRangeParams,
  ) => Promise<LinkedEditingRanges | null>;
}
