import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import {
  Location,
  ReferenceParams,
} from 'vscode-languageserver-protocol';

export interface BaseReferencesProvider {
  references(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: ReferenceParams,
  ): Promise<Location[] | undefined>;
}
