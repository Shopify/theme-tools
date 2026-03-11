import { CompletionItem } from 'vscode-languageserver';
import { TypeSystem } from '../../TypeSystem';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { GetThemeSettingsSchemaForURI } from '../../settings';
export declare class ObjectAttributeCompletionProvider implements Provider {
    private readonly typeSystem;
    private readonly getThemeSettingsSchema;
    constructor(typeSystem: TypeSystem, getThemeSettingsSchema: GetThemeSettingsSchemaForURI);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
}
