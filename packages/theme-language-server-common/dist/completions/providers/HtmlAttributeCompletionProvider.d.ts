import { CompletionItem, Range } from 'vscode-languageserver';
import { AugmentedSourceCode, DocumentManager } from '../../documents';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
export declare class HtmlAttributeCompletionProvider implements Provider {
    private readonly documentManager;
    constructor(documentManager: DocumentManager);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
    hasExistingAttributeValue(attributeTagRange: Range, document: AugmentedSourceCode): boolean;
    hasLiquidTag(attributeTagRange: Range, document: AugmentedSourceCode): boolean;
    attributeTagRange(node: LiquidHtmlNode, document: AugmentedSourceCode): Range;
}
