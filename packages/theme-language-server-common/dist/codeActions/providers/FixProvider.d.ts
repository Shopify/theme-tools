import { CodeAction, CodeActionParams, Command } from 'vscode-languageserver';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
export declare class FixProvider extends BaseCodeActionsProvider {
    static kind: "quickfix";
    codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
