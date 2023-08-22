import { Hover } from 'vscode-languageserver';
import { LiquidHtmlNode } from '@shopify/theme-check-common';

export interface BaseHoverProvider {
  hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null>;
}
