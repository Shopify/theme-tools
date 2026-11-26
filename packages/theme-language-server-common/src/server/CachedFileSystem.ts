import { AbstractFileSystem, FileStat, FileTuple, path } from '@shopify/theme-check-common';

export class CachedFileSystem implements AbstractFileSystem {
  readFile: Cached<string>;
  readDirectory: Cached<FileTuple[]>;
  stat: Cached<FileStat>;

  constructor(fs: AbstractFileSystem) {
    this.readFile = cachedByUri(fs.readFile.bind(fs));
    this.readDirectory = cachedByUri(fs.readDirectory.bind(fs));
    this.stat = cachedByUri(fs.stat.bind(fs));
  }

  /**
   * Invalidates the cached directories that change when files are created,
   * deleted or renamed.
   *
   * Each file's directory gains or loses an entry. A change can also create or
   * remove the directories above it, and the cache can't tell what existed
   * before the change. So this asks the file system which directories exist
   * now, and invalidates each parent listing that disagrees with it.
   *
   * The result depends only on what exists now, so a rename has the same
   * effect whether it arrives as a rename or as a delete and a create, in
   * either order.
   */
  async invalidateDirectories(uris: string[]): Promise<void> {
    const parents = unique(uris.flatMap(parentOf));
    for (const dir of parents) this.readDirectory.invalidate(dir);

    const dirs = unique(parents.flatMap((dir) => [dir, ...directoriesAbove(dir)]));
    // The file system root has no parent listing to check.
    const checks = dirs.flatMap((dir) => parentOf(dir).map((parent) => ({ dir, parent })));

    // Existence is checked with stat because listing a theme root makes
    // code-editor fetch the checksums of the whole theme.
    for (const { dir } of checks) this.stat.invalidate(dir);
    const existsNow = await Promise.all(
      checks.map(({ dir }) =>
        this.stat(dir).then(
          () => true,
          () => false,
        ),
      ),
    );

    checks.forEach(({ dir, parent }, i) => {
      const listing = this.readDirectory.peek(parent);
      const isListed = listing?.some(([uri]) => path.normalize(uri) === dir);
      // isListed is undefined when the listing hasn't resolved, which also
      // invalidates it.
      if (isListed !== existsNow[i]) this.readDirectory.invalidate(parent);
    });
  }
}

interface Cached<T> {
  (uri: string): Promise<T>;
  invalidate(uri: string): void;
  /** Returns the cached value if it has resolved, without calling the file system. */
  peek(uri: string): T | undefined;
}

/**
 * Returns the directory that contains uri as a one-item list, or an empty
 * list for the root.
 */
function parentOf(uri: string): [string] | [] {
  const dir = path.dirname(uri);
  // dirname returns the root unchanged. Requiring a shorter URI also
  // guarantees that walks up the tree end.
  const uriIsAbsoluteRoot = dir.length >= uri.length;
  return uriIsAbsoluteRoot ? [] : [dir];
}

/**
 * Lists the directories above uri, nearest first, ending at the root.
 */
function directoriesAbove(uri: string): string[] {
  return parentOf(uri).flatMap((dir) => [dir, ...directoriesAbove(dir)]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function cachedByUri<T>(fn: (uri: string) => Promise<T>): Cached<T> {
  const cache = new Map<string, Promise<T>>();
  const resolved = new Map<string, T>();

  function cached(uri: string) {
    if (!cache.has(uri)) {
      // I'm intentionally leaving this comment here for debugging purposes :)
      // console.error('cache miss', fn.name, uri);
      const promise = fn(uri);
      cache.set(uri, promise);
      promise.then(
        (value) => {
          // Skip results that were invalidated while pending.
          if (cache.get(uri) === promise) resolved.set(uri, value);
        },
        // The caller handles the rejection.
        () => {},
      );
    }
    return cache.get(uri)!;
  }

  cached.invalidate = (uri: string) => {
    // I'm intentionally leaving this comment here for debugging purposes :)
    // console.error('cache invalidate', fn.name, uri);
    cache.delete(uri);
    resolved.delete(uri);
  };

  cached.peek = (uri: string) => resolved.get(uri);

  return cached;
}
