import { AbstractFileSystem, FileTuple } from '@shopify/theme-check-common';

export class CachedFileSystem implements AbstractFileSystem {
  readFile: Cached<AbstractFileSystem['readFile']>;
  readDirectory: Cached<AbstractFileSystem['readDirectory']>;
  stat: Cached<AbstractFileSystem['stat']>;
  readFiles?: CachedBatch<NonNullable<AbstractFileSystem['readFiles']>>;
  readDirectories?: CachedBatch<NonNullable<AbstractFileSystem['readDirectories']>>;

  private fileCache = new Map<string, Promise<string>>();
  private directoryCache = new Map<string, Promise<FileTuple[]>>();

  constructor(private fs: AbstractFileSystem) {
    this.readFile = cachedByUri(fs.readFile.bind(fs));
    this.readDirectory = cachedByUri(fs.readDirectory.bind(fs));
    this.stat = cachedByUri(fs.stat.bind(fs));

    // Only define batch methods if the underlying fs supports them
    if (fs.readFiles) {
      this.readFiles = this.createCachedReadFiles(fs.readFiles.bind(fs));
    }
    if (fs.readDirectories) {
      this.readDirectories = this.createCachedReadDirectories(fs.readDirectories.bind(fs));
    }
  }

  private createCachedReadFiles(
    fn: (uris: string[]) => Promise<Map<string, string>>,
  ): CachedBatch<NonNullable<AbstractFileSystem['readFiles']>> {
    const batchFn = async (uris: string[]): Promise<Map<string, string>> => {
      const result = new Map<string, string>();
      const uncachedUris: string[] = [];

      // Check cache first
      for (const uri of uris) {
        if (this.fileCache.has(uri)) {
          // console.error('cache hit (batch)', uri);
          result.set(uri, await this.fileCache.get(uri)!);
        } else {
          uncachedUris.push(uri);
        }
      }

      // Fetch uncached files
      if (uncachedUris.length > 0) {
        // console.error('cache miss (batch)', `${uncachedUris.length} files`);
        const batchResult = await fn(uncachedUris);

        // Store in cache and add to result
        for (const [uri, content] of batchResult) {
          const promise = Promise.resolve(content);
          this.fileCache.set(uri, promise);
          result.set(uri, content);
        }
      }

      return result;
    };

    batchFn.invalidate = (uri: string) => {
      // console.error('cache invalidate (batch)', uri);
      this.fileCache.delete(uri);
    };

    batchFn.invalidateAll = () => {
      // console.error('cache invalidate all files');
      this.fileCache.clear();
    };

    return batchFn;
  }

  private createCachedReadDirectories(
    fn: (uris: string[]) => Promise<Map<string, FileTuple[]>>,
  ): CachedBatch<NonNullable<AbstractFileSystem['readDirectories']>> {
    const batchFn = async (uris: string[]): Promise<Map<string, FileTuple[]>> => {
      const result = new Map<string, FileTuple[]>();
      const uncachedUris: string[] = [];

      // Check cache first
      for (const uri of uris) {
        if (this.directoryCache.has(uri)) {
          // console.error('cache hit (batch dir)', uri);
          result.set(uri, await this.directoryCache.get(uri)!);
        } else {
          uncachedUris.push(uri);
        }
      }

      // Fetch uncached directories
      if (uncachedUris.length > 0) {
        // console.error('cache miss (batch dir)', `${uncachedUris.length} directories`);
        const batchResult = await fn(uncachedUris);

        // Store in cache and add to result
        for (const [uri, files] of batchResult) {
          const promise = Promise.resolve(files);
          this.directoryCache.set(uri, promise);
          result.set(uri, files);
        }
      }

      return result;
    };

    batchFn.invalidate = (uri: string) => {
      // console.error('cache invalidate (batch dir)', uri);
      this.directoryCache.delete(uri);
    };

    batchFn.invalidateAll = () => {
      // console.error('cache invalidate all directories');
      this.directoryCache.clear();
    };

    return batchFn;
  }
}

interface Cached<Fn extends (uri: string) => Promise<any>, T = ReturnType<Fn>> {
  (uri: string): T;
  invalidate(uri: string): void;
}

interface CachedBatch<
  Fn extends (uris: string[]) => Promise<Map<string, any>>,
  T = ReturnType<Fn>,
> {
  (uris: string[]): T;
  invalidate(uri: string): void;
  invalidateAll(): void;
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
