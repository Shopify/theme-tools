import { CompletionItem } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../../params';

export interface Provider {
  completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
