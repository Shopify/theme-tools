import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export type GetSnippetNamesForURI = (uri: string) => Promise<string[]>;
export declare class RenderSnippetCompletionProvider implements Provider {
    private readonly getSnippetNamesForURI;
    constructor(getSnippetNamesForURI?: GetSnippetNamesForURI);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
