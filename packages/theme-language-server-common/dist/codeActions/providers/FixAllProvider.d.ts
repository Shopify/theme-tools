import { CodeAction, CodeActionParams, Command } from 'vscode-languageserver';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
/**
 * FixAllProvider is a `source.fixAll` code action provider.
 *
 * It is different from FixProvider in the sense where this won't appear on
 * top of diagnostics, but rather can be executed in different contexts.
 * Unlike FixProvider, it is also cursor position independent.
 *
 * Folks can have this run automatically on save with the following config:
 *
 * "[liquid]": {
 *   "editor.codeActionsOnSave": {
 *     "source.fixAll": true,
 *   }
 * },
 *
 * Or as as 'Right click > Source Actions...' request
 */
export declare class FixAllProvider extends BaseCodeActionsProvider {
    static kind: "source.fixAll";
    codeActions(params: CodeActionParams): (Command | CodeAction)[];
}
