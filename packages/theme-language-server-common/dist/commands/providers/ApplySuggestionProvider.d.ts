import { Command } from 'vscode-languageserver';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';
/**
 * The ApplySuggestionProvider is responsible for handling the `themeCheck/applySuggestion` command.
 *
 * To create a command, use the `applySuggestionCommand` function.
 * The provider will execute the command with the given arguments.
 *
 * ApplySuggestionProvider collects the text edits represented by the targeted offense' `.suggest` property,
 * applies them, and forwards the result to the client using the 'workspace/applyEdit' request.
 */
export declare class ApplySuggestionProvider extends BaseExecuteCommandProvider {
    static command: "themeCheck/applySuggestion";
    execute(uri: string, version: number | undefined, anomalyId: number, suggestionIndex: number): Promise<void>;
}
/**
 * applySuggestionCommand creates an LSP Command that the client can call
 */
export declare function applySuggestionCommand(uri: string, version: number | undefined, anomalyId: number, suggestionIndex: number): Command;
