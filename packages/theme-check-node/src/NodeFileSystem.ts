import { FileStat, FileSystem, FileTuple, FileType } from '@shopify/theme-check-common';
import fs from 'node:fs/promises';

function asAbsolutePath(uri: string): string {
  return uri.replace('file://', '');
}

export const NodeFileSystem: FileSystem = {
  async readFile(uri: string): Promise<string> {
    return fs.readFile(asAbsolutePath(uri), 'utf8');
  },

  async readDirectory(uri: string): Promise<FileTuple[]> {
    const files = await fs.readdir(asAbsolutePath(uri), { withFileTypes: true });
    return files.map((file) => {
      return [`${uri}/${file.name}`, file.isDirectory() ? FileType.Directory : FileType.File];
    });
  },

  async stat(uri: string): Promise<FileStat> {
    try {
      const stats = await fs.stat(asAbsolutePath(uri));
      return {
        type: stats.isDirectory() ? FileType.Directory : FileType.File,
        size: stats.size,
      };
    } catch (e) {
      throw new Error(`Failed to get file stat: ${e}`);
    }
  },
};
