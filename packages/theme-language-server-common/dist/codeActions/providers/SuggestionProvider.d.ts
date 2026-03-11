import { CodeAction, CodeActionParams, Command } from 'vscode-languageserver';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
export declare class SuggestionProvider extends BaseCodeActionsProvider {
    static kind: "quickfix";
    codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
