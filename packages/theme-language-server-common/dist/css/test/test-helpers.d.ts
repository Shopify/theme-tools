import { CompletionItem, CompletionList, CompletionParams, HoverParams } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
export declare function getRequestParams(documentManager: DocumentManager, relativePath: string, source: string): HoverParams & CompletionParams;
export declare function isCompletionList(completions: null | CompletionList | CompletionItem[]): completions is CompletionList;
