import { DocumentOnTypeFormattingParams, Position, TextEdit } from 'vscode-languageserver-protocol';
import { AugmentedSourceCode } from '../documents';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface BaseOnTypeFormattingProvider {
  onTypeFormatting(
    document: AugmentedSourceCode,
    params: DocumentOnTypeFormattingParams,
  ): TextEdit[] | null;
}

export type SetCursorPosition = (textDocument: TextDocument, position: Position) => Promise<void>;
