import {
  AbstractFileSystem,
  path,
  recursiveReadDirectory,
  SourceCode,
  SourceCodeType,
  Theme,
  toSourceCode,
} from '@shopify/theme-check-common';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-languageserver-types';

export type AugmentedSourceCode<SCT extends SourceCodeType = SourceCodeType> = SourceCode<SCT> & {
  textDocument: TextDocument;
  uri: URI;
};

export type AugmentedLiquidSourceCode = AugmentedSourceCode<SourceCodeType.LiquidHtml>;
export type AugmentedJsonSourceCode = AugmentedSourceCode<SourceCodeType.JSON>;

export class DocumentManager {
  /**
   * The sourceCodes map is a map of URIs to SourceCodes. It is used to keep
   * track of all the open documents in the workspace as well as caching the ASTs
   * of the documents.
   *
   * Files that are opened in the editor have a defined version, while files that
   * are preloaded have a version of `undefined`.
   */
  private sourceCodes: Map<URI, AugmentedSourceCode>;
  private readonly fs: AbstractFileSystem | undefined;

  constructor(fs?: AbstractFileSystem) {
    this.sourceCodes = new Map();
    this.fs = fs;
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

  public delete(uri: URI) {
    return this.sourceCodes.delete(uri);
  }

  public theme(root: URI, includeFilesFromDisk = false): AugmentedSourceCode[] {
    return [...this.sourceCodes.values()]
      .filter((sourceCode) => sourceCode.uri.startsWith(root))
      .filter(
        (sourceCode) => includeFilesFromDisk || sourceCode.version !== undefined,
      ) satisfies Theme;
  }

  public get openDocuments(): AugmentedSourceCode[] {
    return [...this.sourceCodes.values()].filter((sourceCode) => sourceCode.version !== undefined);
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
        sourceCode.version ?? 0, // create doesn't let us put undefined here.
        sourceCode.source,
      ),
    });
  }

  /**
   * The preload method is used to pre-load and pre-parse all the files in the
   * theme. It is smart and only will load files that are not already in the
   * DocumentManager.
   *
   * Files that are loaded from the AbstractFileSystem will have a version of `undefined`.
   */
  public async preload(rootUri: URI) {
    if (!this.fs) throw new Error('Cannot call preload without a FileSystem');
    const missingFiles = await recursiveReadDirectory(
      this.fs,
      rootUri,
      ([uri]) => /.(liquid|json)$/.test(uri) && !this.sourceCodes.has(uri),
    );
    await Promise.all(
      missingFiles.map(async (file) => this.set(file, await this.fs!.readFile(file), undefined)),
    );
  }
}
