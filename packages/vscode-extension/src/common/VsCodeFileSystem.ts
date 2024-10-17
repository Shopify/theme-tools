import { AbstractFileSystem, FileTuple, FileStat } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

/** e.g. `file`, `vscode-vfs`, `github`, `browser` */
export type UriScheme = string;

/**
 * An optimization we can use so the Language Server can avoid
 * querying VS Code for information.
 *
 * In the desktop version of the extension, the `file` scheme gets mapped to the
 * NodeFileSystem class.
 *
 * In the browser, this is not available, so the Language Server queries
 * VS Code for the information.
 */
export type FileSystems = Record<UriScheme, AbstractFileSystem>;

export class VsCodeFileSystem implements AbstractFileSystem {
  constructor(
    private connection: Connection,
    private fileSystems: Record<UriScheme, AbstractFileSystem>,
  ) {}

  readDirectory(uriString: string): Promise<FileTuple[]> {
    const uri = URI.parse(uriString);
    const fs = this.fileSystems[uri.scheme];
    if (fs) return fs.readDirectory(uriString);
    return this.connection.sendRequest('fs/readDirectory', uriString);
  }

  readFile(uriString: string): Promise<string> {
    const uri = URI.parse(uriString);
    const fs = this.fileSystems[uri.scheme];
    if (fs) return fs.readFile(uriString);
    return this.connection.sendRequest('fs/readFile', uriString);
  }

  stat(uriString: string): Promise<FileStat> {
    const uri = URI.parse(uriString);
    const fs = this.fileSystems[uri.scheme];
    if (fs) return fs.stat(uriString);
    return this.connection.sendRequest('fs/stat', uriString);
  }
}
