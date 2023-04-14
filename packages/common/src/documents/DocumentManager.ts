import {
  SourceCode,
  SourceCodeType,
  Theme,
  toSourceCode,
} from '@shopify/theme-check-common';
import { URI } from 'vscode-languageserver-types';
import { toAbsolutePath } from '../utils';

export type AugmentedSourceCode = SourceCode<SourceCodeType> & { uri: URI };

// Goals:
// - Memory efficient
// - Fast
//
// Trying to avoid:
// - Subtle memory bugs
// - Reparsing unnecessarily
//
// Things that are true:
// - offenses[file] = f(theme, config)
// - theme = f(root)
// - root = f(file)
// - sourceCode = f(file, root) // because relativePath
// - sourceCode = f(file), since root is f(file)
//
// Things that would be weird:
// - If a file has two roots (e.g. root .theme-check.yml and src/.theme-check.yml)
// - This doesn't make sense so the parent should ignore the src folder.
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
