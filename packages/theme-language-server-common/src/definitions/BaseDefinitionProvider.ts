import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { DefinitionLink, DefinitionParams } from 'vscode-languageserver-protocol';

export interface BaseDefinitionProvider {
  definitions(
    params: DefinitionParams,
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<DefinitionLink[]>;
}
