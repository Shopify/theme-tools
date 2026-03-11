import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { DefinitionParams, DefinitionLink } from 'vscode-languageserver-protocol';
import { DocumentManager, AugmentedJsonSourceCode } from '../../documents';
import { BaseDefinitionProvider } from '../BaseDefinitionProvider';
export declare class TranslationStringDefinitionProvider implements BaseDefinitionProvider {
    private documentManager;
    private getDefaultLocaleSourceCode;
    constructor(documentManager: DocumentManager, getDefaultLocaleSourceCode: (uri: string) => Promise<AugmentedJsonSourceCode | null>);
    definitions(params: DefinitionParams, node: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<DefinitionLink[]>;
}
