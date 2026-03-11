import { Hover } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
export declare class HtmlAttributeHoverProvider implements BaseHoverProvider {
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null>;
}
