import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { render } from '../../docset';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidFilterHoverProvider implements BaseHoverProvider {
  constructor(private themeDocset: ThemeDocset) {}

  async hover(currentNode: LiquidHtmlNode): Promise<Hover | null> {
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
        value: render(entry, undefined, 'filter'),
      },
    };
  }
}
