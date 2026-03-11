import { CompletionItem, CompletionList, CompletionParams, Diagnostic, DocumentDiagnosticParams, Hover, HoverParams, ClientCapabilities as LSPClientCapabilities } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
export declare class CSSLanguageService {
    private documentManager;
    private service;
    constructor(documentManager: DocumentManager);
    setup(clientCapabilities: LSPClientCapabilities): Promise<void>;
    completions(params: CompletionParams): Promise<null | CompletionList | CompletionItem[]>;
    diagnostics(params: DocumentDiagnosticParams): Promise<Diagnostic[]>;
    hover(params: HoverParams): Promise<Hover | null>;
    private getDocuments;
}
