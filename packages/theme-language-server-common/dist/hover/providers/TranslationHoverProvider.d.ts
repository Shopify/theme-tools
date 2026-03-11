import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { GetTranslationsForURI } from '../../translations';
import { BaseHoverProvider } from '../BaseHoverProvider';
export declare class TranslationHoverProvider implements BaseHoverProvider {
    getTranslationsForUri: GetTranslationsForURI;
    documentManager: DocumentManager;
    constructor(getTranslationsForUri: GetTranslationsForURI, documentManager: DocumentManager);
    hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: HoverParams): Promise<Hover | null>;
}
