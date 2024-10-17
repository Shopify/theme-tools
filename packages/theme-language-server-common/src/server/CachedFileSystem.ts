import { AbstractFileSystem } from '@shopify/theme-check-common';

export class CachedFileSystem implements AbstractFileSystem {
  readFile: Cached<AbstractFileSystem['readFile']>;
  readDirectory: Cached<AbstractFileSystem['readDirectory']>;
  stat: Cached<AbstractFileSystem['stat']>;

  constructor(fs: AbstractFileSystem) {
    this.readFile = cachedByUri(fs.readFile.bind(fs));
    this.readDirectory = cachedByUri(fs.readDirectory.bind(fs));
    this.stat = cachedByUri(fs.stat.bind(fs));
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
