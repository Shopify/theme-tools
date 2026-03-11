import { CompletionItem, CompletionList, CompletionParams, HoverParams } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { GetThemeBlockNames } from '../JSONContributions';
import { JSONLanguageService } from '../JSONLanguageService';
import { GetTranslationsForURI } from '../../translations';
export declare function getRequestParams(documentManager: DocumentManager, relativePath: string, source: string): HoverParams & CompletionParams;
export declare function isCompletionList(completions: null | CompletionList | CompletionItem[]): completions is CompletionList;
export declare function mockJSONLanguageService(rootUri: string, documentManager: DocumentManager, getDefaultSchemaTranslations?: GetTranslationsForURI, getThemeBlockNames?: GetThemeBlockNames): JSONLanguageService;
