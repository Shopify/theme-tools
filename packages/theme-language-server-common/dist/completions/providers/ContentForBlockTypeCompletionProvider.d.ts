import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class ContentForBlockTypeCompletionProvider implements Provider {
    private readonly getThemeBlockNames;
    constructor(getThemeBlockNames: (rootUri: string, includePrivate: boolean) => Promise<string[]>);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
