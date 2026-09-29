import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams, MarkupKind } from 'vscode-languageserver';
import { GetTranslationsForURI } from '../../translations';
import {
  formatBlockParameterDescription,
  formatBlockParameterHeading,
  getBlockParameterTranslations,
  GetBlockParametersForURI,
} from '../../utils/blockParameters';
import { BaseHoverProvider } from '../BaseHoverProvider';

/**
 * Documents a named argument of a `block` tag with the target block's merged
 * schema, LiquidDoc, and built-in parameter definition.
 *
 * @example {% block 'card', hea█ding: 'Sale' %}
 */
export class BlockParameterHoverProvider implements BaseHoverProvider {
  constructor(
    private readonly getBlockParametersForURI: GetBlockParametersForURI,
    private readonly getSchemaTranslationsForURI: GetTranslationsForURI,
  ) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const blockMarkup = ancestors.at(-1);
    if (currentNode.type !== NodeTypes.NamedArgument) return null;
    if (blockMarkup?.type !== NodeTypes.BlockMarkup) return null;

    const parameters = await this.getBlockParametersForURI(
      params.textDocument.uri,
      blockMarkup.name.value,
    );
    const parameter = parameters?.get(currentNode.name);
    if (!parameter) return null;

    const translations = await getBlockParameterTranslations(
      this.getSchemaTranslationsForURI,
      params.textDocument.uri,
      [parameter],
    );
    const value = [
      formatBlockParameterHeading(parameter),
      formatBlockParameterDescription(parameter, translations),
    ]
      .filter(Boolean)
      .join('\n\n');

    return { contents: { kind: MarkupKind.Markdown, value } };
  }
}
