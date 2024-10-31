import { RenameFilesParams } from 'vscode-languageserver-protocol';
import { AugmentedSourceCode } from '../documents';

export interface BaseRenameHandler {
  onDidRenameFiles(params: RenameFilesParams, theme: AugmentedSourceCode[]): Promise<void>;
}
