import { SourceCodeType } from '@shopify/theme-check-common';
import { DocumentLink, Range } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { AugmentedReference } from '../types';

type GetDependencies = (uri: string) => Promise<AugmentedReference[]>;

export class DocumentLinksProvider {
  constructor(
    private documentManager: DocumentManager,
    private getDependencies: GetDependencies,
  ) {}

  async documentLinks(uri: string): Promise<DocumentLink[]> {
    const sourceCode = this.documentManager.get(uri);
    if (
      !sourceCode ||
      sourceCode.type !== SourceCodeType.LiquidHtml ||
      sourceCode.ast instanceof Error
    ) {
      return [];
    }

    const dependencies = await this.getDependencies(uri);
    return dependencies.flatMap(({ source, target }) => {
      if (!source.range) return [];

      const range = Range.create(
        sourceCode.textDocument.positionAt(source.range[0]),
        sourceCode.textDocument.positionAt(source.range[1]),
      );
      return [DocumentLink.create(range, target.uri)];
    });
  }
}
