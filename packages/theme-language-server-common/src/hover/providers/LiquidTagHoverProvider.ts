import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { render } from '../../docset';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidTagHoverProvider implements BaseHoverProvider {
  constructor(public themeDocset: ThemeDocset) {}

  async hover(currentNode: LiquidHtmlNode): Promise<Hover | null> {
    if (currentNode.type !== NodeTypes.LiquidTag && currentNode.type !== NodeTypes.LiquidBranch) {
      return null;
    }

    const name = currentNode.name;
    const entries = await this.themeDocset.tags();
    const entry = entries.find((entry) => entry.name === name);
    if (!entry) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: render(entry, undefined, 'tag'),
      },
    };
  }
}
