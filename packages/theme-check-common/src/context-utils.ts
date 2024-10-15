import { URI, Utils } from 'vscode-uri';
import { FileSystem, FileTuple, FileType, UriString } from './FileSystem';

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
    } catch (error) {
      return 0;
    }
  };

export function getDefaultLocaleFactory(
  fs: FileSystem,
  rootUri: string,
  postfix: string = '.default.json',
) {
  /** These things are cached per run, not across runs */
  return cached(() => getDefaultLocale(fs, rootUri, postfix));
}

async function getDefaultLocale(fs: FileSystem, rootUri: string, postfix: string): Promise<string> {
  const root = URI.parse(rootUri);
  try {
    const files = await fs.readDirectory(Utils.joinPath(root, 'locales').toString());
    const defaultLocaleFile = files.find(([uri]) => uri.endsWith(postfix));
    const defaultLocaleFileName = Utils.basename(
      URI.parse(defaultLocaleFile?.[0] ?? 'en.default.json'),
    );
    const defaultLocale = defaultLocaleFileName.split('.')[0];
    return defaultLocale ?? 'en';
  } catch (error) {
    console.error(error);
    return 'en';
  }
}

function cached<T>(fn: () => Promise<T>): () => Promise<T>;
function cached<T>(fn: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
  let cachedPromise: Promise<T>;
  return async (...args) => {
    if (!cachedPromise) cachedPromise = fn(...args);
    return cachedPromise;
  };
}

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

export function isDirectory([_, type]: FileTuple) {
  return type === FileType.Directory;
}
