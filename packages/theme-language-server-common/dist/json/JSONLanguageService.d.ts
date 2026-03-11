import { JsonValidationSet, Mode } from '@shopify/theme-check-common';
import { CompletionItem, CompletionList, CompletionParams, DocumentLink, DocumentLinkParams, Hover, HoverParams, ClientCapabilities as LSPClientCapabilities } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { GetTranslationsForURI } from '../translations';
import { GetThemeBlockNames, GetThemeBlockSchema } from './JSONContributions';
import { FindThemeRootURI } from '../internal-types';
export declare class JSONLanguageService {
    private documentManager;
    private jsonValidationSet;
    private getDefaultSchemaTranslations;
    private getModeForURI;
    private getThemeBlockNames;
    private getThemeBlockSchema;
    private findThemeRootURI;
    private services;
    private schemas;
    initialized: Promise<void>;
    private initialize;
    constructor(documentManager: DocumentManager, jsonValidationSet: JsonValidationSet, getDefaultSchemaTranslations: GetTranslationsForURI, getModeForURI: (uri: string) => Promise<Mode>, getThemeBlockNames: GetThemeBlockNames, getThemeBlockSchema: GetThemeBlockSchema, findThemeRootURI: FindThemeRootURI);
    setup(clientCapabilities: LSPClientCapabilities): Promise<void>;
    completions(params: CompletionParams): Promise<null | CompletionList | CompletionItem[]>;
    hover(params: HoverParams): Promise<Hover | null>;
    documentLinks(params: DocumentLinkParams): Promise<DocumentLink[]>;
    isValidSchema: (uri: string, jsonString: string) => Promise<boolean>;
    private getDocuments;
    private getSchemaForURI;
}
