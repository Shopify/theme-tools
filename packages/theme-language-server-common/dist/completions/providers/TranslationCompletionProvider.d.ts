import { CompletionItem } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { GetTranslationsForURI } from '../../translations';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class TranslationCompletionProvider implements Provider {
    private readonly documentManager;
    private readonly getTranslationsForURI;
    constructor(documentManager: DocumentManager, getTranslationsForURI: GetTranslationsForURI);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
