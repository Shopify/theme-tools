import { GetDocDefinitionForURI, MetafieldDefinitionMap, ThemeDocset } from '@shopify/theme-check-common';
import { CompletionItem, CompletionParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { GetThemeSettingsSchemaForURI } from '../settings';
import { GetTranslationsForURI } from '../translations';
import { GetSnippetNamesForURI } from './providers';
export interface CompletionProviderDependencies {
    documentManager: DocumentManager;
    themeDocset: ThemeDocset;
    getTranslationsForURI?: GetTranslationsForURI;
    getSnippetNamesForURI?: GetSnippetNamesForURI;
    getThemeSettingsSchemaForURI?: GetThemeSettingsSchemaForURI;
    getMetafieldDefinitions: (rootUri: string) => Promise<MetafieldDefinitionMap>;
    getDocDefinitionForURI?: GetDocDefinitionForURI;
    getThemeBlockNames?: (rootUri: string, includePrivate: boolean) => Promise<string[]>;
    log?: (message: string) => void;
}
export declare class CompletionsProvider {
    private providers;
    readonly documentManager: DocumentManager;
    readonly themeDocset: ThemeDocset;
    readonly log: (message: string) => void;
    constructor({ documentManager, themeDocset, getMetafieldDefinitions, getTranslationsForURI, getSnippetNamesForURI, getThemeSettingsSchemaForURI, getDocDefinitionForURI, getThemeBlockNames, log, }: CompletionProviderDependencies);
    completions(params: CompletionParams): Promise<CompletionItem[]>;
}
