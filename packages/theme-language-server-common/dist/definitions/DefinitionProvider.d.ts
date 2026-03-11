import { DefinitionLink, DefinitionParams } from 'vscode-languageserver';
import { AugmentedJsonSourceCode, DocumentManager } from '../documents';
export declare class DefinitionProvider {
    private documentManager;
    private providers;
    constructor(documentManager: DocumentManager, getDefaultLocaleSourceCode: (uri: string) => Promise<AugmentedJsonSourceCode | null>, getDefaultSchemaLocaleSourceCode: (uri: string) => Promise<AugmentedJsonSourceCode | null>);
    definitions(params: DefinitionParams): Promise<DefinitionLink[] | null>;
}
