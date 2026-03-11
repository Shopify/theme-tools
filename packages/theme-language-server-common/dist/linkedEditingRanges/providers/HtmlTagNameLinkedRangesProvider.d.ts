import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { LinkedEditingRangeParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseLinkedEditingRangesProvider } from '../BaseLinkedEditingRangesProvider';
export declare class HtmlTagNameLinkedRangesProvider implements BaseLinkedEditingRangesProvider {
    documentManager: DocumentManager;
    constructor(documentManager: DocumentManager);
    linkedEditingRanges(node: LiquidHtmlNode | null, ancestors: LiquidHtmlNode[] | null, params: LinkedEditingRangeParams): Promise<{
        ranges: import("vscode-languageserver").Range[];
        wordPattern: string;
    } | null>;
}
