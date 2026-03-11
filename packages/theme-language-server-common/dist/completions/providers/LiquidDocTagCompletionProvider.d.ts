import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class LiquidDocTagCompletionProvider implements Provider {
    constructor();
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
    private createCompletionItems;
}
