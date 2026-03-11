import { Facet } from '@codemirror/state';
import { AbstractLanguageClient } from '../LanguageClient';
import { ServerCapabilities } from 'vscode-languageserver-protocol';
export declare const clientFacet: Facet<AbstractLanguageClient, AbstractLanguageClient>;
export declare const fileUriFacet: Facet<string, string>;
export declare const serverCapabilitiesFacet: Facet<ServerCapabilities<any> | null, ServerCapabilities<any>>;
