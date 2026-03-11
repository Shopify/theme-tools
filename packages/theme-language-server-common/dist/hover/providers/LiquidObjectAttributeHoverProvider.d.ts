import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { TypeSystem } from '../../TypeSystem';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class LiquidObjectAttributeHoverProvider implements BaseHoverProvider {
    private typeSystem;
    constructor(typeSystem: TypeSystem);
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: HoverParams): Promise<Hover | null>;
}
