import { ThemeDocset } from '@shopify/theme-check-common';
import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class LiquidTagsCompletionProvider implements Provider {
    private readonly themeDocset;
    constructor(themeDocset: ThemeDocset);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
