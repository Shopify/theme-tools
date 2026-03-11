import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { LinkedEditingRangeParams, LinkedEditingRanges } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseLinkedEditingRangesProvider } from '../BaseLinkedEditingRangesProvider';
export declare class EmptyHtmlTagLinkedRangesProvider implements BaseLinkedEditingRangesProvider {
    documentManager: DocumentManager;
    constructor(documentManager: DocumentManager);
    linkedEditingRanges(node: LiquidHtmlNode | null, ancestors: LiquidHtmlNode[] | null, { textDocument: { uri }, position }: LinkedEditingRangeParams): Promise<LinkedEditingRanges | null>;
}
