import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { Hover, HoverParams, MarkupKind, Range } from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { formatBlockParameter, GetBlockParametersForURI } from '../../utils/blockParameters';
import { BaseHoverProvider } from '../BaseHoverProvider';

/**
 * Documents a named argument of a `block` tag with the target block's merged
 * schema, LiquidDoc, and built-in parameter definition.
 *
 * @example {% block 'card', hea█ding: 'Sale' %}
 */
export class BlockParameterHoverProvider implements BaseHoverProvider {
  constructor(
    private readonly documentManager: DocumentManager,
    private readonly getBlockParametersForURI: GetBlockParametersForURI,
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
    const textDocument = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!parameter || !textDocument) return null;

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: formatBlockParameter(parameter),
      },
      range: Range.create(
        textDocument.positionAt(currentNode.position.start),
        textDocument.positionAt(currentNode.position.start + currentNode.name.length),
      ),
    };
  }
}
