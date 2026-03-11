import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { ThemeDocset } from '@shopify/theme-check-common';
export declare class LiquidDocParamTypeCompletionProvider implements Provider {
    private readonly themeDocset;
    constructor(themeDocset: ThemeDocset);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
