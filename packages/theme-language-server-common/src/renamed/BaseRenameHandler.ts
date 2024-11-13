import { RenameFilesParams } from 'vscode-languageserver-protocol';

export interface BaseRenameHandler {
  onDidRenameFiles(params: RenameFilesParams): Promise<void>;
}
