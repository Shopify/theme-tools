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

export type UriString = string;

export type FileTuple = [uri: UriString, fileType: FileType];

export interface FileSystem {
  stat(uri: string): Promise<FileStat>;
  readFile(uri: string): Promise<string>;
  readDirectory(uri: string): Promise<FileTuple[]>;
}

export const makeFileExists = (fs: FileSystem) =>
  async function fileExists(uri: string) {
    try {
      await fs.stat(uri);
      return true;
    } catch (e) {
      return false;
    }
  };

export const makeFileSize = (fs: FileSystem) =>
  async function fileSize(uri: string) {
    try {
      const stats = await fs.stat(uri);
      return stats.size;
    } catch (e) {
      throw new Error(`Failed to get file size: ${e}`);
    }
  };

export async function recursiveReadDirectory(
  fs: FileSystem,
  uri: string,
  filter: (fileTuple: FileTuple) => boolean,
): Promise<UriString[]> {
  const allFiles = await fs.readDirectory(uri);
  const files = allFiles.filter((ft) => isDirectory(ft) || filter(ft));

  const results = await Promise.all(
    files.map((ft) => {
      if (isDirectory(ft)) {
        return recursiveReadDirectory(fs, ft[0], filter);
      } else {
        return Promise.resolve([ft[0]]);
      }
    }),
  );

  return results.flat();
}

function isDirectory([_, type]: FileTuple) {
  return type === FileType.Directory;
}
