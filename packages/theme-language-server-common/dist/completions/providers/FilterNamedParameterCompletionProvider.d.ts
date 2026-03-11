import { LiquidVariableLookup } from '@shopify/liquid-html-parser';
import { ThemeDocset } from '@shopify/theme-check-common';
import { CompletionItem, InsertTextFormat, TextEdit } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { AugmentedLiquidSourceCode } from '../../documents';
export declare class FilterNamedParameterCompletionProvider implements Provider {
    private readonly themeDocset;
    constructor(themeDocset: ThemeDocset);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
    textEdit(node: LiquidVariableLookup, document: AugmentedLiquidSourceCode, name: string, type: string): {
        textEdit: TextEdit;
        format: InsertTextFormat;
    };
}
