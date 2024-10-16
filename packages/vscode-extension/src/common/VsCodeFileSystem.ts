import { AbstractFileSystem, FileTuple, FileStat } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

export class VsCodeFileSystem implements AbstractFileSystem {
  constructor(
    private connection: Connection,
    private fileSystems: Record<string, AbstractFileSystem>,
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
