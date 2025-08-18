/**
 * The AbstractFileSystem interface is used to abstract file system operations.
 *
 * This way, the Theme Check library can be used in different environments,
 * such as the browser, node.js or VS Code (which works with local files, remote
 * files and on the web)
 */
export interface AbstractFileSystem {
  stat(uri: string): Promise<FileStat>;
  readFile(uri: string): Promise<string>;
  readDirectory(uri: string): Promise<FileTuple[]>;

  /**
   * Optional batch read method for reading multiple files at once.
   * Returns a Map of URI to file content.
   * @param uris Array of URIs to read
   * @returns Map where keys are URIs and values are file contents
   */
  readFiles?(uris: string[]): Promise<Map<string, string>>;

  /**
   * Optional batch read method for reading multiple directories at once.
   * Returns a Map of URI to directory contents.
   * @param uris Array of directory URIs to read
   * @returns Map where keys are URIs and values are arrays of FileTuples
   */
  readDirectories?(uris: string[]): Promise<Map<string, FileTuple[]>>;
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export interface FileStat {
  type: FileType;
  size: number;
}

/** A vscode-uri string */
export type UriString = string;

export type FileTuple = [uri: UriString, fileType: FileType];
