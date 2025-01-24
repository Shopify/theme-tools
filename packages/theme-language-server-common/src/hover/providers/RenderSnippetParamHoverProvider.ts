import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { GetSnippetDefinitionForURI } from '../../liquidDoc';

import { BaseHoverProvider } from '../BaseHoverProvider';
import { Hover, HoverParams } from 'vscode-languageserver';

export class RenderSnippetParamHoverProvider implements BaseHoverProvider {
  constructor(private getSnippetDefinitionForURI: GetSnippetDefinitionForURI) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    return null;
  }
}
