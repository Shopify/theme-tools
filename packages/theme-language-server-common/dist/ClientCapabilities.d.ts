import { ClientCapabilities as LanguageClientCapabilities, InitializeParams } from 'vscode-languageserver';
export declare class ClientCapabilities {
    private capabilities?;
    private initializationOptions?;
    setup(capabilities: LanguageClientCapabilities, initializationOptions?: InitializeParams['initializationOptions']): void;
    get hasWorkspaceConfigurationSupport(): boolean;
    get hasApplyEditSupport(): boolean;
    get hasWorkspaceFoldersSupport(): boolean;
    get hasDidChangeConfigurationDynamicRegistrationSupport(): boolean;
    get hasDidChangeWatchedFilesDynamicRegistrationSupport(): boolean;
    get hasShowDocumentSupport(): boolean;
    get hasProgressSupport(): boolean;
    initializationOption<T>(key: string, defaultValue: T): T;
}
