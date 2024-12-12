import { LiquidHtmlNode, LiquidRawTag, LiquidString, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType } from '@shopify/theme-check-common';
import { DocumentLink, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';

import { DocumentManager } from '../documents';
import { visit, Visitor } from '@shopify/theme-check-common';

import { parseTree, findNodeAtLocation, ParseError, Node as JSONNode } from 'jsonc-parser';

export class DocumentLinksProvider {
  constructor(
    private documentManager: DocumentManager,
    private findThemeRootURI: (uri: string) => Promise<string>,
  ) {}

  async documentLinks(uriString: string): Promise<DocumentLink[]> {
    const sourceCode = this.documentManager.get(uriString);
    if (
      !sourceCode ||
      sourceCode.type !== SourceCodeType.LiquidHtml ||
      sourceCode.ast instanceof Error
    ) {
      return [];
    }

    const rootUri = await this.findThemeRootURI(uriString);
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

    LiquidRawTag(node) {
      // look for schema tags
      if (node.name === 'schema') {
        // parse and return a tree of the schema
        const errors: ParseError[] = [];
        const jsonNode = parseTree(node.body.value, errors);
        if (!jsonNode || errors.length > 0) {
          return [];
        }

        // create an array of links so we can process all block types and preset block types in the schema
        const links: DocumentLink[] = [];

        // Process top-level blocks
        const blocksNode = findNodeAtLocation(jsonNode, ['blocks']);
        if (blocksNode && blocksNode.type === 'array' && blocksNode.children) {
          links.push(...createLinksFromBlocks(blocksNode, node, textDocument, root));
        }

        // Process presets
        const presetsNode = findNodeAtLocation(jsonNode, ['presets']);
        if (presetsNode && presetsNode.type === 'array' && presetsNode.children) {
          presetsNode.children.forEach((presetNode) => {
            // Process blocks within each preset
            const presetBlocksNode = findNodeAtLocation(presetNode, ['blocks']);
            if (presetBlocksNode) {
              links.push(...processPresetBlocks(presetBlocksNode, node, textDocument, root));
            }
          });
        }

        return links;
      }
      return [];
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

function createDocumentLinkForTypeNode(
  typeNode: JSONNode,
  parentNode: LiquidRawTag,
  textDocument: TextDocument,
  root: URI,
  blockType: string,
): DocumentLink | null {
  const startOffset = typeNode.offset;
  const endOffset = typeNode.offset + typeNode.length;
  const startPos = parentNode.body.position.start + startOffset;
  const endPos = parentNode.body.position.start + endOffset;

  const start = textDocument.positionAt(startPos);
  const end = textDocument.positionAt(endPos);

  return DocumentLink.create(
    Range.create(start, end),
    Utils.resolvePath(root, 'blocks', `${blockType}.liquid`).toString(),
  );
}

function processPresetBlocks(
  blocksNode: JSONNode,
  parentNode: LiquidRawTag,
  textDocument: TextDocument,
  root: URI,
): DocumentLink[] {
  const links: DocumentLink[] = [];

  if (blocksNode.type === 'object' && blocksNode.children) {
    blocksNode.children.forEach((propertyNode) => {
      const blockValueNode = propertyNode.children?.[1]; // The value node of the property
      if (!blockValueNode) return;

      // Check if the block has a 'name' key so we don't deeplink inline block types
      const nameNode = findNodeAtLocation(blockValueNode, ['name']);
      if (nameNode) {
        return;
      }

      const typeNode = findNodeAtLocation(blockValueNode, ['type']);
      if (typeNode && typeNode.type === 'string' && typeof typeNode.value === 'string') {
        const blockType = typeNode.value;
        if (blockType.startsWith('@')) {
          return;
        }

        const link = createDocumentLinkForTypeNode(
          typeNode,
          parentNode,
          textDocument,
          root,
          blockType,
        );

        if (link) {
          links.push(link);
        }
      }

      // Recursively process nested blocks
      const nestedBlocksNode = findNodeAtLocation(blockValueNode, ['blocks']);
      if (nestedBlocksNode) {
        links.push(...processPresetBlocks(nestedBlocksNode, parentNode, textDocument, root));
      }
    });
  } else if (blocksNode.type === 'array' && blocksNode.children) {
    blocksNode.children.forEach((blockNode) => {
      // Check if the block has a 'name' key
      const nameNode = findNodeAtLocation(blockNode, ['name']);
      if (nameNode) {
        return; // Skip creating a link if 'name' key exists
      }

      const typeNode = findNodeAtLocation(blockNode, ['type']);
      if (typeNode && typeNode.type === 'string' && typeof typeNode.value === 'string') {
        const blockType = typeNode.value;
        if (blockType.startsWith('@')) {
          return;
        }

        const link = createDocumentLinkForTypeNode(
          typeNode,
          parentNode,
          textDocument,
          root,
          blockType,
        );

        if (link) {
          links.push(link);
        }
      }

      // Recursively process nested blocks
      const nestedBlocksNode = findNodeAtLocation(blockNode, ['blocks']);
      if (nestedBlocksNode) {
        links.push(...processPresetBlocks(nestedBlocksNode, parentNode, textDocument, root));
      }
    });
  }

  return links;
}

function createLinksFromBlocks(
  blocksNode: JSONNode,
  parentNode: LiquidRawTag,
  textDocument: TextDocument,
  root: URI,
): DocumentLink[] {
  const links: DocumentLink[] = [];

  if (blocksNode.children) {
    blocksNode.children.forEach((blockNode: JSONNode) => {
      // Check if the block has a 'name' key to avoid deeplinking inline block types
      const nameNode = findNodeAtLocation(blockNode, ['name']);
      if (nameNode) {
        return;
      }

      const typeNode = findNodeAtLocation(blockNode, ['type']);
      if (typeNode && typeNode.type === 'string' && typeof typeNode.value === 'string') {
        const blockType = typeNode.value;
        if (blockType.startsWith('@')) {
          return;
        }

        const link = createDocumentLinkForTypeNode(
          typeNode,
          parentNode,
          textDocument,
          root,
          blockType,
        );

        if (link) {
          links.push(link);
        }
      }
    });
  }

  return links;
}
