import { JSONNode, SourceCodeType } from '@shopify/theme-check-common';
import { DocumentLink, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';
import { visit, Visitor } from '@shopify/theme-check-common';
import { DocumentManager } from '../../documents';
import { FindThemeRootURI } from '../../internal-types';

export class JsonDocumentLinksProvider {
  constructor(
    private documentManager: DocumentManager,
    private findThemeRootURI: FindThemeRootURI,
  ) {}

  async documentLinks(uriString: string): Promise<DocumentLink[]> {
    const sourceCode = this.documentManager.get(uriString);
    if (!sourceCode || sourceCode.type !== SourceCodeType.JSON || sourceCode.ast instanceof Error) {
      return [];
    }

    const rootUri = await this.findThemeRootURI(uriString);
    if (!rootUri) {
      return [];
    }

    const visitor = createJSONDocumentLinksVisitor(sourceCode.textDocument, URI.parse(rootUri));
    return visit(sourceCode.ast, visitor);
  }
}

export function createJSONDocumentLinksVisitor(
  textDocument: TextDocument,
  root: URI,
  offset: number = 0,
): Visitor<SourceCodeType.JSON, DocumentLink> {
  const visitor: Visitor<SourceCodeType.JSON, DocumentLink> = {
    Property(node, ancestors) {
      // Section type references
      if (
        node.key.value === 'type' &&
        isInSectionsContext(ancestors) &&
        node.value.type === 'Literal' &&
        typeof node.value.value === 'string'
      ) {
        return DocumentLink.create(
          range(textDocument, node.value, offset),
          Utils.resolvePath(root, 'sections', node.value.value + '.liquid').toString(),
        );
      }

      // Block type references
      if (
        node.key.value === 'type' &&
        isInBlocksContext(ancestors) &&
        node.value.type === 'Literal' &&
        typeof node.value.value === 'string' &&
        !['@app', '@theme'].includes(node.value.value)
      ) {
        return DocumentLink.create(
          range(textDocument, node.value, offset),
          Utils.resolvePath(root, 'blocks', node.value.value + '.liquid').toString(),
        );
      }
    },
  };
  return visitor;
}

function range(textDocument: TextDocument, node: JSONNode, offset: number): Range {
  const start = textDocument.positionAt(offset + node.loc.start.offset + 1);
  const end = textDocument.positionAt(offset + node.loc.end.offset - 1);
  return Range.create(start, end);
}

function isInSectionsContext(ancestors: JSONNode[]): boolean {
  return ancestors.some(
    (ancestor) => ancestor.type === 'Property' && ancestor.key.value === 'sections',
  );
}

function isInBlocksContext(ancestors: JSONNode[]): boolean {
  return ancestors.some(
    (ancestor) => ancestor.type === 'Property' && ancestor.key.value === 'blocks',
  );
}
