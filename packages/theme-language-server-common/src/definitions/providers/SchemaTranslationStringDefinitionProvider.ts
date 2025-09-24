import { LiquidHtmlNode, LiquidRawTag, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType, findJSONNode, nodeAtPath } from '@shopify/theme-check-common';
import {
  DefinitionLink,
  DefinitionParams,
  LocationLink,
  Range,
} from 'vscode-languageserver-protocol';
import { AugmentedJsonSourceCode, DocumentManager } from '../../documents';
import { BaseDefinitionProvider } from '../BaseDefinitionProvider';

export class SchemaTranslationStringDefinitionProvider implements BaseDefinitionProvider {
  constructor(
    private documentManager: DocumentManager,
    private getDefaultSchemaLocaleSourceCode: (
      uri: string,
    ) => Promise<AugmentedJsonSourceCode | null>,
  ) {}

  async definitions(
    params: DefinitionParams,
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<DefinitionLink[]> {
    const sourceCode = this.documentManager.get(params.textDocument.uri);
    if (!sourceCode || sourceCode.type !== SourceCodeType.LiquidHtml) return [];

    // We want text inside {% schema %}
    if (node.type !== NodeTypes.TextNode) return [];
    const schemaTag = ancestors.find(isSchemaTag);
    if (!schemaTag) {
      return [];
    }

    const schema = await sourceCode.getSchema();
    if (!schema || schema.ast instanceof Error) return [];

    // Now we need to find the location of the translation in the translation file
    const defaultLocaleFile = await this.getDefaultSchemaLocaleSourceCode(params.textDocument.uri);
    if (
      !defaultLocaleFile ||
      defaultLocaleFile.type !== SourceCodeType.JSON ||
      defaultLocaleFile.ast instanceof Error
    ) {
      return [];
    }

    const documentOffset = sourceCode.textDocument.offsetAt(params.position);
    const offset = documentOffset - schema.offset;
    const [jNode, _jAncestors] = findJSONNode(schema.ast, offset);

    if (jNode.type !== 'Literal') return [];
    if (typeof jNode.value !== 'string' || !jNode.value.startsWith('t:')) return [];

    const translationKey = jNode.value.slice(2).trim();
    const translationNode = nodeAtPath(defaultLocaleFile.ast, translationKey.split('.'));

    if (!translationNode) return [];

    const targetRange = Range.create(
      defaultLocaleFile.textDocument.positionAt(translationNode.loc.start.offset),
      defaultLocaleFile.textDocument.positionAt(translationNode.loc.end.offset),
    );
    const originRange = Range.create(
      sourceCode.textDocument.positionAt(schema.offset + jNode.loc.start.offset),
      sourceCode.textDocument.positionAt(schema.offset + jNode.loc.end.offset),
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

function isSchemaTag(node: LiquidHtmlNode): node is LiquidRawTag & { name: 'schema' } {
  return node.type === NodeTypes.LiquidRawTag && node.name === 'schema';
}
