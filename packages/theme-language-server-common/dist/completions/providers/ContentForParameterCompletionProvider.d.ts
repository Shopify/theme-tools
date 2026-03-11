import { LiquidVariableLookup } from '@shopify/liquid-html-parser';
import { CompletionItem, InsertTextFormat, TextEdit } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { AugmentedLiquidSourceCode } from '../../documents';
import { GetDocDefinitionForURI } from '@shopify/theme-check-common';
/**
 * Offers completions for parameters for the `content_for` tag after a user has
 * specificied the type.
 *
 * @example {% content_for "block", █ %}
 */
export declare class ContentForParameterCompletionProvider implements Provider {
    private readonly getDocDefinitionForURI;
    constructor(getDocDefinitionForURI: GetDocDefinitionForURI);
    completions(params: LiquidCompletionParams): Promise<CompletionItem[]>;
    textEdit(node: LiquidVariableLookup, document: AugmentedLiquidSourceCode, name: string, textTemplate?: string): {
        textEdit: TextEdit;
        format: InsertTextFormat;
    };
    private staticCompletions;
    private liquidDocParameterCompletions;
}
