import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { DefinitionLink, DefinitionParams } from 'vscode-languageserver-protocol';
import { AugmentedJsonSourceCode, DocumentManager } from '../../documents';
import { BaseDefinitionProvider } from '../BaseDefinitionProvider';
export declare class SchemaTranslationStringDefinitionProvider implements BaseDefinitionProvider {
    private documentManager;
    private getDefaultSchemaLocaleSourceCode;
    constructor(documentManager: DocumentManager, getDefaultSchemaLocaleSourceCode: (uri: string) => Promise<AugmentedJsonSourceCode | null>);
    definitions(params: DefinitionParams, node: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<DefinitionLink[]>;
}
