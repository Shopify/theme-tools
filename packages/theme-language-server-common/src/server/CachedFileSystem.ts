import { AbstractFileSystem, path } from '@shopify/theme-check-common';

export class CachedFileSystem implements AbstractFileSystem {
  readFile: Cached<AbstractFileSystem['readFile']>;
  readDirectory: Cached<AbstractFileSystem['readDirectory']>;
  stat: Cached<AbstractFileSystem['stat']>;

  constructor(fs: AbstractFileSystem) {
    this.readFile = cachedByUri(fs.readFile.bind(fs));
    this.readDirectory = cachedByUri(fs.readDirectory.bind(fs));
    this.stat = cachedByUri(fs.stat.bind(fs));
  }

  /**
   * Invalidates readDirectory and stat for every directory above uri.
   *
   * Creating or deleting a file can create or remove several directories at
   * once, which changes the listing above the highest one.
   */
  invalidateDirectories(uri: string): void {
    const dir = path.dirname(uri);
    // dirname returns the root unchanged. Requiring a shorter URI also
    // guarantees that the recursion ends.
    const uriIsAbsoluteRoot = dir.length >= uri.length;
    if (uriIsAbsoluteRoot) return;

    this.readDirectory.invalidate(dir);
    this.stat.invalidate(dir);
    this.invalidateDirectories(dir);
  }
}

interface Cached<Fn extends (uri: string) => Promise<any>, T = ReturnType<Fn>> {
  (uri: string): T;
  invalidate(uri: string): void;
}

function cachedByUri<T>(fn: (uri: string) => Promise<T>): Cached<typeof fn> {
  const cache = new Map<string, Promise<T>>();

  function cached(uri: string) {
    if (!cache.has(uri)) {
      // I'm intentionally leaving this comment here for debugging purposes :)
      // console.error('cache miss', fn.name, uri);
      cache.set(uri, fn(uri));
    }
    return cache.get(uri)!;
  }

  cached.invalidate = (uri: string) => {
    // I'm intentionally leaving this comment here for debugging purposes :)
    // console.error('cache invalidate', fn.name, uri);
    cache.delete(uri);
  };

  return cached;
}
