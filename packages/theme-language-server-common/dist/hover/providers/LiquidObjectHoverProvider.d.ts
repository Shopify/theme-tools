import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { Hover, HoverParams } from 'vscode-languageserver';
import { TypeSystem } from '../../TypeSystem';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class LiquidObjectHoverProvider implements BaseHoverProvider {
    private typeSystem;
    constructor(typeSystem: TypeSystem);
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: HoverParams): Promise<Hover | null>;
}
