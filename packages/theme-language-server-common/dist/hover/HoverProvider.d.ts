import { GetDocDefinitionForURI, MetafieldDefinitionMap, ThemeDocset } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { GetTranslationsForURI } from '../translations';
import { GetThemeSettingsSchemaForURI } from '../settings';
export declare class HoverProvider {
    readonly documentManager: DocumentManager;
    readonly themeDocset: ThemeDocset;
    readonly getMetafieldDefinitions: (rootUri: string) => Promise<MetafieldDefinitionMap>;
    readonly getTranslationsForURI: GetTranslationsForURI;
    readonly getSettingsSchemaForURI: GetThemeSettingsSchemaForURI;
    readonly getDocDefinitionForURI: GetDocDefinitionForURI;
    private providers;
    constructor(documentManager: DocumentManager, themeDocset: ThemeDocset, getMetafieldDefinitions: (rootUri: string) => Promise<MetafieldDefinitionMap>, getTranslationsForURI?: GetTranslationsForURI, getSettingsSchemaForURI?: GetThemeSettingsSchemaForURI, getDocDefinitionForURI?: GetDocDefinitionForURI);
    hover(params: HoverParams): Promise<Hover | null>;
}
