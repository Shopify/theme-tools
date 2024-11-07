import { AbstractFileSystem, FileStat, FileTuple, FileType } from '../AbstractFileSystem';
import { normalize, relative } from '../path';
import { MockTheme } from './MockTheme';

interface FileTree {
  [fileName: string]: string | FileTree;
}

export class MockFileSystem implements AbstractFileSystem {
  private rootUri: string;

  constructor(private mockTheme: MockTheme, rootUri = 'file:///') {
    this.rootUri = normalize(rootUri);
  }

  async readFile(uri: string): Promise<string> {
    const relativePath = this.rootRelative(uri);
    if (this.mockTheme[relativePath] === undefined) {
      throw new Error('File not found');
    } else {
      return this.mockTheme[relativePath];
    }
  }

  async readDirectory(uri: string): Promise<FileTuple[]> {
    uri = uri.replace(/\/$/, '');
    const relativePath = this.rootRelative(uri);
    const tree =
      normalize(uri) === this.rootUri
        ? this.fileTree
        : deepGet(this.fileTree, relativePath.split('/'));
    if (tree === undefined) {
      throw new Error(`Directory not found: ${uri}`);
    }

    if (typeof tree === 'string') {
      return [[uri, FileType.File]];
    }

    return Object.entries(tree).map(([fileName, value]) => {
      return [`${uri}/${fileName}`, typeof value === 'string' ? FileType.File : FileType.Directory];
    });
  }

  async stat(uri: string): Promise<FileStat> {
    const relativePath = this.rootRelative(uri);
    const source = this.mockTheme[relativePath];
    if (source === undefined) {
      throw new Error('File not found');
    }
    return {
      type: FileType.File,
      size: source.length ?? 0,
    };
  }

  private _fileTree: FileTree | null = null;

  private get fileTree(): FileTree {
    if (!this._fileTree) {
      this._fileTree = {};
      for (const [relativePath, source] of Object.entries(this.mockTheme)) {
        const segments = relativePath.split('/');
        let current = this._fileTree;
        for (let i = 0; i < segments.length - 1; i++) {
          const segment = segments[i];
          current[segment] ??= {};
          current = current[segment] as FileTree;
        }
        current[segments[segments.length - 1]] = source;
      }
    }
    return this._fileTree;
  }

  private rootRelative(uri: string) {
    return relative(normalize(uri), this.rootUri);
  }
}

function deepGet(obj: any, path: string[]): any {
  return path.reduce((acc, key) => acc?.[key], obj);
}
