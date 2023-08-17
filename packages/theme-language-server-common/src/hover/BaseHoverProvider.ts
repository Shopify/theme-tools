import { Hover, HoverParams } from 'vscode-languageserver';
import { LiquidHtmlNode } from '@shopify/theme-check-common';

export interface BaseHoverProvider {
  hover(
    params: HoverParams,
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<Hover | null>;
}
