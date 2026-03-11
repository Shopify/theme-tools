import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { DocumentHighlightParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseDocumentHighlightsProvider } from '../BaseDocumentHighlightsProvider';
export declare class HtmlTagNameDocumentHighlightsProvider implements BaseDocumentHighlightsProvider {
    documentManager: DocumentManager;
    constructor(documentManager: DocumentManager);
    documentHighlights(node: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: DocumentHighlightParams): Promise<{
        range: import("vscode-languageserver").Range;
    }[] | null>;
}
