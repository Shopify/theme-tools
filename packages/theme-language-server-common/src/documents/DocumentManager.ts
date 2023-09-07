import { SourceCode, SourceCodeType, Theme, toSourceCode } from '@shopify/theme-check-common';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-languageserver-types';
import { toAbsolutePath } from '../utils';

export type AugmentedSourceCode = SourceCode<SourceCodeType> & {
  textDocument: TextDocument;
  uri: URI;
};

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
    return this.sourceCodes.get(uri);
  }

  private set(uri: URI, source: string, version: number | undefined) {
    const absolutePath = toAbsolutePath(uri);

    // We only support json and liquid files.
    if (!/\.(json|liquid)$/.test(absolutePath) || /\.(s?css|js).liquid$/.test(absolutePath)) {
      return;
    }

    const sourceCode = toSourceCode(absolutePath, source, version);
    this.sourceCodes.set(uri, {
      ...sourceCode,
      textDocument: TextDocument.create(
        uri,
        sourceCode.type,
        sourceCode.version ?? 0,
        sourceCode.source,
      ),
      uri,
    });
  }
}
