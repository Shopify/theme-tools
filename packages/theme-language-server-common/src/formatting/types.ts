import { DocumentOnTypeFormattingParams, Position, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AugmentedSourceCode } from '../documents';

export interface BaseOnTypeFormattingProvider {
  onTypeFormatting(
    document: AugmentedSourceCode,
    params: DocumentOnTypeFormattingParams,
  ): TextEdit[] | null;
}

export type SetCursorPosition = (textDocument: TextDocument, position: Position) => Promise<void>;
