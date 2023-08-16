import { Hover, HoverParams } from 'vscode-languageserver';
import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { NodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';
import { render } from '../../completions/providers/common';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidTagHoverProvider implements BaseHoverProvider {
  constructor(public themeDocset: ThemeDocset) { }

  async hover(params: HoverParams, currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null> {
    if (currentNode.type !== NodeTypes.LiquidTag && currentNode.type !== NodeTypes.LiquidBranch) {
      return null;
    }

    const name = currentNode.name;
    const entries = await this.themeDocset.tags();
    const entry = entries.find(entry => entry.name === name);
    if (!entry) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: render(entry),
      },
    };
  }
}
