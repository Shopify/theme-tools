import {
  FileStat,
  AbstractFileSystem,
  FileTuple,
  FileType,
  path,
} from '@shopify/theme-check-common';
import fs from 'node:fs/promises';

export const NodeFileSystem: AbstractFileSystem = {
  async readFile(uri: string): Promise<string> {
    // I'm intentionally leaving these comments here for debugging purposes :)
    // console.error('fs/readFile', uri);
    return fs.readFile(path.fsPath(uri), 'utf8');
  },

  async readDirectory(uri: string): Promise<FileTuple[]> {
    // console.error('fs/readDirectory', uri);
    const files = await fs.readdir(path.fsPath(uri), { withFileTypes: true });
    return files.map((file) => {
      return [
        `${uri}/${file.name}`.replace('file:////', 'file:///'), // fun edge case
        file.isDirectory() ? FileType.Directory : FileType.File,
      ];
    });
  },

  async stat(uri: string): Promise<FileStat> {
    // console.error('fs/stat', uri);
    try {
      const stats = await fs.stat(path.fsPath(uri));
      return {
        type: stats.isDirectory() ? FileType.Directory : FileType.File,
        size: stats.size,
      };
    } catch (e) {
      throw new Error(`Failed to get file stat: ${e}`);
    }
  },
};
