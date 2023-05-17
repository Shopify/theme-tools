import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
} from 'vscode-languageserver';

export interface BaseCodeActionsProvider {
  kind: CodeActionKind;
  codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
