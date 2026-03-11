import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { DocumentManager } from '../../documents';
export declare class LiquidDocTagHoverProvider implements BaseHoverProvider {
    private documentManager;
    constructor(documentManager: DocumentManager);
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: HoverParams): Promise<Hover | null>;
}
