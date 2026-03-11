import { CompletionItem } from 'vscode-languageserver';
import { TypeSystem } from '../../TypeSystem';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class ObjectCompletionProvider implements Provider {
    private readonly typeSystem;
    constructor(typeSystem: TypeSystem);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
