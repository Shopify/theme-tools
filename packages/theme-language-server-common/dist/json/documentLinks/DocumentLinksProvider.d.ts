import { SourceCodeType } from '@shopify/theme-check-common';
import { DocumentLink } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { Visitor } from '@shopify/theme-check-common';
export declare function createJSONDocumentLinksVisitor(textDocument: TextDocument, root: URI, offset?: number): Visitor<SourceCodeType.JSON, DocumentLink>;
