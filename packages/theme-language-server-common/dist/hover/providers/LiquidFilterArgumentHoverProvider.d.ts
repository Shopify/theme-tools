import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class LiquidFilterArgumentHoverProvider implements BaseHoverProvider {
    private themeDocset;
    constructor(themeDocset: ThemeDocset);
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null>;
}
