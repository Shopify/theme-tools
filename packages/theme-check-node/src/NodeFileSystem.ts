import {
  FileStat,
  AbstractFileSystem,
  FileTuple,
  FileType,
  path,
} from '@shopify/theme-check-common';
import fs from 'node:fs/promises';
import { getFileSystemBatchSize } from '@shopify/theme-check-common';

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
      return [path.join(uri, file.name), file.isDirectory() ? FileType.Directory : FileType.File];
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

  async readFiles(uris: string[]): Promise<Map<string, string>> {
    // console.error('fs/readFiles', `${uris.length} files`);
    const result = new Map<string, string>();

    // Process in chunks to avoid overwhelming the system with very large batches
    const chunkSize = getFileSystemBatchSize();
    for (let i = 0; i < uris.length; i += chunkSize) {
      const chunk = uris.slice(i, i + chunkSize);
      const promises = chunk.map(async (uri) => {
        try {
          const content = await fs.readFile(path.fsPath(uri), 'utf8');
          return { uri, content };
        } catch (error) {
          // Log error but don't fail the entire batch
          console.error(`Failed to read file ${uri}:`, error);
          return { uri, content: '' };
        }
      });

      const results = await Promise.all(promises);
      for (const { uri, content } of results) {
        result.set(uri, content);
      }
    }

    return result;
  },

  async readDirectories(uris: string[]): Promise<Map<string, FileTuple[]>> {
    // console.error('fs/readDirectories', `${uris.length} directories`);
    const result = new Map<string, FileTuple[]>();

    const promises = uris.map(async (uri) => {
      try {
        const files = await fs.readdir(path.fsPath(uri), { withFileTypes: true });
        const fileTuples: FileTuple[] = files.map((file) => {
          return [
            path.join(uri, file.name),
            file.isDirectory() ? FileType.Directory : FileType.File,
          ];
        });
        return { uri, fileTuples };
      } catch (error) {
        console.error(`Failed to read directory ${uri}:`, error);
        return { uri, fileTuples: [] };
      }
    });

    const results = await Promise.all(promises);
    for (const { uri, fileTuples } of results) {
      result.set(uri, fileTuples);
    }

    return result;
  },
};
