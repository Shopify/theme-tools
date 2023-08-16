import { Hover, HoverParams } from 'vscode-languageserver';
import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { NodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';
import { render } from '../../completions/providers/common';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidFilterHoverProvider implements BaseHoverProvider {
  constructor(private themeDocset: ThemeDocset) { }

  async hover(
    _params: HoverParams,
    currentNode: LiquidHtmlNode,
    _ancestors: LiquidHtmlNode[]
  ): Promise<Hover | null> {
    if (currentNode.type !== NodeTypes.LiquidFilter) {
      return null;
    }

    const name = currentNode.name;
    const entries = await this.themeDocset.filters();
    const entry = entries.find((entry) => entry.name === name);
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
