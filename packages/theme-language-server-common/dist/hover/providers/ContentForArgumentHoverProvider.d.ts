import { LiquidHtmlNode, GetDocDefinitionForURI } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class ContentForArgumentHoverProvider implements BaseHoverProvider {
    private getDocDefinitionForURI;
    constructor(getDocDefinitionForURI: GetDocDefinitionForURI);
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: HoverParams): Promise<Hover | null>;
}
