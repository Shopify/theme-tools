import { Command } from 'vscode-languageserver';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';
/**
 * The ApplyFixesProvider is responsible for handling the `themeCheck/applyFixes` command.
 *
 * To create a command, use the `applyFixCommand` function.
 * The provider will execute the command with the given arguments.
 *
 * ApplyFixesProvider collects the text edits represented by the targeted offenses' `.fix` property,
 * applies them, and forwards the result to the client using the 'workspace/applyEdit' request.
 */
export declare class ApplyFixesProvider extends BaseExecuteCommandProvider {
    static command: "themeCheck/applyFixes";
    execute(uri: string, version: number | undefined, ids: number[]): Promise<void>;
}
/**
 * applyFixCommand creates an LSP Command that the client can call
 */
export declare function applyFixCommand(uri: string, version: number | undefined, ids: number[]): Command;
