import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class LiquidTagHoverProvider implements BaseHoverProvider {
    themeDocset: ThemeDocset;
    constructor(themeDocset: ThemeDocset);
    hover(currentNode: LiquidHtmlNode): Promise<Hover | null>;
}
