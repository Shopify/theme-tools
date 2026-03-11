import { LiquidFilter } from '@shopify/liquid-html-parser';
import { FilterEntry } from '@shopify/theme-check-common';
import { CompletionItem, InsertTextFormat, TextEdit } from 'vscode-languageserver';
import { PseudoType, TypeSystem } from '../../TypeSystem';
import { AugmentedLiquidSourceCode } from '../../documents';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
export declare class FilterCompletionProvider implements Provider {
    private readonly typeSystem;
    constructor(typeSystem: TypeSystem);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
    textEdit(node: LiquidFilter, document: AugmentedLiquidSourceCode, entry: MaybeDeprioritisedFilterEntry): {
        textEdit: TextEdit;
        format: InsertTextFormat;
    };
    options: (inputType: PseudoType) => Promise<MaybeDeprioritisedFilterEntry[]>;
}
type MaybeDeprioritisedFilterEntry = FilterEntry & {
    deprioritized?: boolean;
};
export {};
