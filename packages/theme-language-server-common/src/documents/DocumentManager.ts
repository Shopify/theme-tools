import { path, SourceCode, SourceCodeType, Theme, toSourceCode } from '@shopify/theme-check-common';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-languageserver-types';

export type AugmentedSourceCode<SCT extends SourceCodeType = SourceCodeType> = SourceCode<SCT> & {
  textDocument: TextDocument;
  uri: URI;
};

export type AugmentedLiquidSourceCode = AugmentedSourceCode<SourceCodeType.LiquidHtml>;
export type AugmentedJsonSourceCode = AugmentedSourceCode<SourceCodeType.JSON>;

export class DocumentManager {
  private sourceCodes: Map<URI, AugmentedSourceCode>;

  constructor() {
    this.sourceCodes = new Map();
  }

  public open(uri: URI, source: string, version: number | undefined) {
    return this.set(uri, source, version);
  }

  public change(uri: URI, source: string, version: number | undefined) {
    return this.set(uri, source, version);
  }

  public close(uri: URI) {
    return this.sourceCodes.delete(uri);
  }

  public theme(root: URI): AugmentedSourceCode[] {
    return [...this.sourceCodes.entries()]
      .filter(([uri]) => uri.startsWith(root))
      .map(([, sourceCode]) => sourceCode) satisfies Theme;
  }

  public get openDocuments(): AugmentedSourceCode[] {
    return [...this.sourceCodes.values()];
  }

  public get(uri: URI) {
    return this.sourceCodes.get(path.normalize(uri));
  }

  private set(uri: URI, source: string, version: number | undefined) {
    uri = path.normalize(uri);
    // We only support json and liquid files.
    if (!/\.(json|liquid)$/.test(uri) || /\.(s?css|js).liquid$/.test(uri)) {
      return;
    }

    const sourceCode = toSourceCode(uri, source, version);
    this.sourceCodes.set(uri, {
      ...sourceCode,
      textDocument: TextDocument.create(
        uri,
        sourceCode.type,
        sourceCode.version ?? 0,
        sourceCode.source,
      ),
    });
  }
}
