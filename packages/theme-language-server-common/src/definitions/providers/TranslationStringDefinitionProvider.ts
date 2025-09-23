import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType, nodeAtPath } from '@shopify/theme-check-common';
import {
  DefinitionParams,
  DefinitionLink,
  Range,
  LocationLink,
} from 'vscode-languageserver-protocol';
import { DocumentManager, AugmentedJsonSourceCode } from '../../documents';
import { BaseDefinitionProvider } from '../BaseDefinitionProvider';

export class TranslationStringDefinitionProvider implements BaseDefinitionProvider {
  constructor(
    private documentManager: DocumentManager,
    private getDefaultLocaleSourceCode: (uri: string) => Promise<AugmentedJsonSourceCode | null>,
  ) {}

  async definitions(
    params: DefinitionParams,
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<DefinitionLink[]> {
    const doc = this.documentManager.get(params.textDocument.uri)?.textDocument;
    if (!doc) return [];

    // We want {{ node | t }}
    if (node.type !== NodeTypes.String) return [];
    const parent = ancestors.at(-1);
    if (!parent || parent.type !== NodeTypes.LiquidVariable) return [];

    // Making sure node is the expression
    if (parent.expression !== node) return [];

    // We're looking for {{ '...' | t }} or {{ '...' | translate }}
    if (parent.filters.length === 0 || !['t', 'translate'].includes(parent.filters[0].name)) {
      return [];
    }

    // Now we need to find the location of the translation in the translation file
    const defaultLocaleFile = await this.getDefaultLocaleSourceCode(params.textDocument.uri);
    if (
      !defaultLocaleFile ||
      defaultLocaleFile.type !== SourceCodeType.JSON ||
      defaultLocaleFile.ast instanceof Error
    ) {
      return [];
    }

    const translationKey = node.value;
    const translationNode = nodeAtPath(defaultLocaleFile.ast, translationKey.split('.'));

    if (!translationNode) return [];

    const targetRange = Range.create(
      defaultLocaleFile.textDocument.positionAt(translationNode.loc.start.offset),
      defaultLocaleFile.textDocument.positionAt(translationNode.loc.end.offset),
    );
    const originRange = Range.create(
      doc.positionAt(node.position.start),
      doc.positionAt(node.position.end),
    );

    return [
      LocationLink.create(
        defaultLocaleFile.textDocument.uri,
        targetRange,
        targetRange,
        originRange,
      ),
    ];
  }
}
