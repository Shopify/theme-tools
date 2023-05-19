import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
} from 'vscode-languageserver';
import { DiagnosticsManager } from '../diagnostics';
import { DocumentManager } from '../documents';

export abstract class BaseCodeActionsProvider {
  static kind: CodeActionKind;

  constructor(
    protected documentManager: DocumentManager,
    protected diagnosticsManager: DiagnosticsManager,
  ) {}

  abstract codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
