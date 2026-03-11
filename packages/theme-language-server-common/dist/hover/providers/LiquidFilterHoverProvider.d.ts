import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class LiquidFilterHoverProvider implements BaseHoverProvider {
    private themeDocset;
    constructor(themeDocset: ThemeDocset);
    hover(currentNode: LiquidHtmlNode): Promise<Hover | null>;
}
