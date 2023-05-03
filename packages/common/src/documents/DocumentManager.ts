import {
  SourceCode,
  SourceCodeType,
  Theme,
  toSourceCode,
} from '@shopify/theme-check-common';
import { URI } from 'vscode-languageserver-types';
import { toAbsolutePath } from '../utils';

export type AugmentedSourceCode = SourceCode<SourceCodeType> & { uri: URI };
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

  private set(uri: URI, source: string, version: number | undefined) {
    const absolutePath = toAbsolutePath(uri);
    const sourceCode = toSourceCode(absolutePath, source, version);

    if (!sourceCode) {
      this.sourceCodes.delete(uri);
    } else {
      this.sourceCodes.set(uri, { ...sourceCode, uri });
    }
  }
}
