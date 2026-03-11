import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { GetDocDefinitionForURI } from '@shopify/theme-check-common';
export type GetSnippetNamesForURI = (uri: string) => Promise<string[]>;
export declare class RenderSnippetParameterCompletionProvider implements Provider {
    private readonly getDocDefinitionForURI;
    constructor(getDocDefinitionForURI: GetDocDefinitionForURI);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
