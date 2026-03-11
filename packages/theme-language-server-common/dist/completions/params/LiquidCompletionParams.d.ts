import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { CompletionParams } from 'vscode-languageserver';
import { AugmentedLiquidSourceCode } from '../../documents';
interface CompletionContext {
    /** The AST of the Liquid template up to the cursor position */
    readonly partialAst: LiquidHtmlNode;
    /** The node at the cursor position, undefined if cursor is not in a node */
    readonly node: LiquidHtmlNode | undefined;
    /** The ancestry that leads to the current node */
    readonly ancestors: LiquidHtmlNode[];
}
export interface LiquidCompletionParams extends CompletionParams {
    /**
     * The completion context represents additional information that would
     * allow you to offer completions at the cursor position.
     *
     * If undefined, then the file is unparseable.
     */
    readonly completionContext: CompletionContext | undefined;
    /** The document from the document manager */
    readonly document: AugmentedLiquidSourceCode;
}
export declare function createLiquidCompletionParams(sourceCode: AugmentedLiquidSourceCode, params: CompletionParams): LiquidCompletionParams;
export {};
