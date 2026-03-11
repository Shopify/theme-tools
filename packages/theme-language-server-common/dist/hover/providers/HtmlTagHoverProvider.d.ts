import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class HtmlTagHoverProvider implements BaseHoverProvider {
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null>;
}
