import {
  AbstractFileSystem,
  assertNever,
  memoize,
  path,
  recursiveReadDirectory,
  SourceCodeType,
  Theme,
  toSourceCode,
  toSchema,
  UriString,
  IsValidSchema,
  memo,
  Mode,
} from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ClientCapabilities } from '../ClientCapabilities';
import { percent, Progress } from '../progress';
import { AugmentedSourceCode } from './types';

export class DocumentManager {
  /**
   * The sourceCodes map is a map of URIs to SourceCodes. It is used to keep
   * track of all the open documents in the workspace as well as caching the ASTs
   * of the documents.
   *
   * Files that are opened in the editor have a defined version, while files that
   * are preloaded have a version of `undefined`.
   */
  private sourceCodes: Map<UriString, AugmentedSourceCode>;

  constructor(
    private readonly fs?: AbstractFileSystem,
    private readonly connection?: Connection,
    private readonly clientCapabilities?: ClientCapabilities,
    private readonly getModeForUri?: (uri: UriString) => Promise<Mode>,
    private readonly isValidSchema?: IsValidSchema,
  ) {
    this.sourceCodes = new Map();
  }

  public open(uri: UriString, source: string, version: number | undefined) {
    return this.set(uri, source, version);
  }

  public change(uri: UriString, source: string, version: number | undefined) {
    return this.set(uri, source, version);
  }

  public close(uri: UriString) {
    const sourceCode = this.sourceCodes.get(uri);
    if (!sourceCode) return;
    return this.set(uri, sourceCode.source, undefined);
  }

  public delete(uri: UriString) {
    return this.sourceCodes.delete(uri);
  }

  public rename(oldUri: UriString, newUri: UriString) {
    const sourceCode = this.sourceCodes.get(oldUri);
    if (!sourceCode) return;
    this.sourceCodes.delete(oldUri);
    this.set(newUri, sourceCode.source, sourceCode.version);
  }

  public theme(root: UriString, includeFilesFromDisk = false): AugmentedSourceCode[] {
    return [...this.sourceCodes.values()]
      .filter((sourceCode) => sourceCode.uri.startsWith(root))
      .filter(
        (sourceCode) => includeFilesFromDisk || sourceCode.version !== undefined,
      ) satisfies Theme;
  }

  public get openDocuments(): AugmentedSourceCode[] {
    return [...this.sourceCodes.values()].filter((sourceCode) => sourceCode.version !== undefined);
  }

  public get(uri: UriString) {
    return this.sourceCodes.get(path.normalize(uri));
  }

  public has(uri: UriString) {
    return this.sourceCodes.has(path.normalize(uri));
  }

  private set(uri: UriString, source: string, version: number | undefined) {
    uri = path.normalize(uri);
    // We only support json and liquid files.
    if (!/\.(json|liquid)$/.test(uri) || /\.(s?css|js).liquid$/.test(uri)) {
      return;
    }

    this.sourceCodes.set(uri, this.augmentedSourceCode(uri, source, version));
  }

  /**
   * The preload method is used to pre-load and pre-parse all the files in the
   * theme. It is smart and only will load files that are not already in the
   * DocumentManager.
   *
   * Files that are loaded from the AbstractFileSystem will have a version of `undefined`.
   */
  public preload = memoize(
    async (rootUri: UriString) => {
      if (!this.fs) throw new Error('Cannot call preload without a FileSystem');
      const { fs, connection, clientCapabilities } = this;
      const progress = Progress.create(connection, clientCapabilities, `preload#${rootUri}`);

      progress.start('Initializing Liquid LSP');

      // We'll only load the files that aren't already in the store. No need to
      // parse a file we already parsed.
      const filesToLoad = await recursiveReadDirectory(
        this.fs,
        rootUri,
        ([uri]) => /\.(liquid|json)$/.test(uri) && !this.sourceCodes.has(uri),
      );

      progress.report(10, 'Preloading files');

      let [i, n] = [0, filesToLoad.length];
      await Promise.all(
        filesToLoad.map(async (file) => {
          // This is what is important, we are loading the file from the file system
          // And setting their initial version to `undefined` to mean "on disk".
          this.set(file, await fs.readFile(file), undefined);

          // This is just doing progress reporting
          if (++i % 10 === 0) {
            const message = `Preloading files [${i}/${n}]`;
            progress.report(percent(i, n, 10), message);
          }
        }),
      );

      progress.end('Completed');
    },
    (rootUri) => rootUri,
  );

  private augmentedSourceCode(
    uri: UriString,
    source: string,
    version: number | undefined,
  ): AugmentedSourceCode {
    const sourceCode = toSourceCode(uri, source, version);
    const textDocument = TextDocument.create(
      uri,
      sourceCode.type,
      sourceCode.version ?? 0, // create doesn't let us put undefined here.
      sourceCode.source,
    );

    switch (sourceCode.type) {
      case SourceCodeType.JSON:
        return {
          ...sourceCode,
          textDocument,
        };
      case SourceCodeType.LiquidHtml:
        return {
          ...sourceCode,
          textDocument,

          /** Lazy and only computed once per file version */
          getSchema: memo(async () => {
            if (!this.getModeForUri || !this.isValidSchema) return undefined;
            const mode = await this.getModeForUri!(uri);
            return toSchema(mode, uri, sourceCode, this.isValidSchema);
          }),
        };
      default:
        return assertNever(sourceCode);
    }
  }
}
