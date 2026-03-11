import { AppBlockSchema, SectionSchema, ThemeBlockSchema } from '@shopify/theme-check-common';
import { CompletionsCollector, JSONPath, JSONWorkerContribution, MarkedString } from 'vscode-json-languageservice';
import { DocumentManager } from '../documents';
import { GetTranslationsForURI } from '../translations';
export type GetThemeBlockSchema = (uri: string, name: string) => Promise<SectionSchema | ThemeBlockSchema | AppBlockSchema | undefined>;
export type GetThemeBlockNames = (uri: string, includePrivate: boolean) => Promise<string[]>;
/**
 * I'm not a fan of how json-languageservice does its feature contributions. It's too different
 * from everything else we do in here.
 *
 * Instead, we'll have this little adapter that makes the completions and hover providers feel
 * a bit more familiar.
 */
export declare class JSONContributions implements JSONWorkerContribution {
    private documentManager;
    private hoverProviders;
    private completionProviders;
    constructor(documentManager: DocumentManager, getDefaultSchemaTranslations: GetTranslationsForURI, getThemeBlockNames: GetThemeBlockNames, getThemeBlockSchema: GetThemeBlockSchema);
    getInfoContribution(uri: string, location: JSONPath): Promise<MarkedString[]>;
    collectPropertyCompletions(uri: string, location: JSONPath, _currentWord: string, _addValue: boolean, _isLast: boolean, result: CompletionsCollector): Promise<void>;
    collectValueCompletions(uri: string, location: JSONPath, propertyKey: string, result: CompletionsCollector): Promise<void>;
    /** I'm not sure we want to do anything with that... but TS requires us to have it */
    collectDefaultCompletions(_uri: string, _result: CompletionsCollector): Promise<void>;
    private getContext;
}
