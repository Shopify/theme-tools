import { JSONNode, SourceCodeType } from '@shopify/theme-check-common';
import { DocumentLink, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';
import { Visitor } from '@shopify/theme-check-common';

export function createJSONDocumentLinksVisitor(
  textDocument: TextDocument,
  root: URI,
  offset: number = 0,
): Visitor<SourceCodeType.JSON, DocumentLink> {
  const visitor: Visitor<SourceCodeType.JSON, DocumentLink> = {
    Property(node, ancestors) {
      const origin = jsonPropertyOriginDirectory(ancestors);

      if (!origin) return;

      if (
        !(
          node.key.value === 'type' &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string'
        )
      ) {
        return;
      }

      if (origin === 'blocks' && ['@app', '@theme'].includes(node.value.value)) {
        return;
      }

      return DocumentLink.create(
        range(textDocument, node.value, offset),
        Utils.resolvePath(root, origin, node.value.value + '.liquid').toString(),
      );
    },
  };
  return visitor;
}

function range(textDocument: TextDocument, node: JSONNode, offset: number): Range {
  // +1 and -1 to exclude the quotes
  const start = textDocument.positionAt(offset + node.loc.start.offset + 1);
  const end = textDocument.positionAt(offset + node.loc.end.offset - 1);
  return Range.create(start, end);
}

function jsonPropertyOriginDirectory(ancestors: JSONNode[]): 'sections' | 'blocks' | undefined {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor.type === 'Property') {
      if (ancestor.key.value === 'blocks') {
        return 'blocks';
      }
      if (ancestor.key.value === 'sections') {
        return 'sections';
      }
    }
  }
  return undefined;
}
