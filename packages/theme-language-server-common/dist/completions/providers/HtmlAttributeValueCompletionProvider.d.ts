import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class HtmlAttributeValueCompletionProvider implements Provider {
    constructor();
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
