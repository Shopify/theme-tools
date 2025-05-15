import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, ThemeDocset } from '@shopify/theme-check-common';
import { Hover } from 'vscode-languageserver';
import { render } from '../../docset';
import { BaseHoverProvider } from '../BaseHoverProvider';

export class LiquidFilterArgumentHoverProvider implements BaseHoverProvider {
  constructor(private themeDocset: ThemeDocset) {}

  async hover(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[]): Promise<Hover | null> {
    const parentNode = ancestors.at(-1);

    if (
      !parentNode ||
      parentNode.type !== NodeTypes.LiquidFilter ||
      currentNode.type !== NodeTypes.NamedArgument
    ) {
      return null;
    }

    const parentName = parentNode.name;
    const entries = await this.themeDocset.filters();
    const entry = entries.find((entry) => entry.name === parentName);

    if (!entry) {
      return null;
    }

    const argument = entry.parameters?.find((argument) => argument.name === currentNode.name);

    if (!argument) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: render(argument, undefined, 'filter'),
      },
    };
  }
}
