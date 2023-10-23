import { LiquidHtmlNode, LiquidString, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType } from '@shopify/theme-check-common';
import { DocumentLink, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import { DocumentManager } from '../documents';
import { visit, Visitor } from '../visitor';

export class DocumentLinksProvider {
  constructor(private documentManager: DocumentManager) {}

  async documentLinks(uriString: string, rootUri: string): Promise<DocumentLink[]> {
    const sourceCode = this.documentManager.get(uriString);
    if (
      !sourceCode ||
      sourceCode.type !== SourceCodeType.LiquidHtml ||
      sourceCode.ast instanceof Error
    ) {
      return [];
    }

    const visitor = documentLinksVisitor(sourceCode.textDocument, URI.parse(rootUri));

    return visit(sourceCode.ast, visitor);
  }
}

function documentLinksVisitor(
  textDocument: TextDocument,
  root: URI,
): Visitor<SourceCodeType.LiquidHtml, DocumentLink> {
  return {
    LiquidTag(node) {
      // {% render 'snippet' %}
      // {% include 'snippet' %}
      if (
        (node.name === 'render' || node.name === 'include') &&
        typeof node.markup !== 'string' &&
        isLiquidString(node.markup.snippet)
      ) {
        const snippet = node.markup.snippet;
        return DocumentLink.create(
          range(textDocument, snippet),
          Utils.resolvePath(root, 'snippets', snippet.value + '.liquid').toString(),
        );
      }

      // {% section 'section' %}
      if (
        node.name === 'section' &&
        typeof node.markup !== 'string' &&
        isLiquidString(node.markup)
      ) {
        const sectionName = node.markup;
        return DocumentLink.create(
          range(textDocument, sectionName),
          Utils.resolvePath(root, 'sections', sectionName.value + '.liquid').toString(),
        );
      }
    },

    // {{ 'theme.js' | asset_url }}
    LiquidVariable(node) {
      if (node.filters.length === 0 || node.filters[0].name !== 'asset_url') {
        return;
      }

      if (!isLiquidString(node.expression)) {
        return;
      }

      const expression = node.expression;
      return DocumentLink.create(
        range(textDocument, node.expression),
        Utils.resolvePath(root, 'assets', expression.value).toString(),
      );
    },
  };
}

function range(textDocument: TextDocument, node: { position: LiquidHtmlNode['position'] }): Range {
  const start = textDocument.positionAt(node.position.start);
  const end = textDocument.positionAt(node.position.end);
  return Range.create(start, end);
}

function isLiquidString(node: LiquidHtmlNode): node is LiquidString {
  return node.type === NodeTypes.String;
}
