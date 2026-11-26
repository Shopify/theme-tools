import {
  AbstractFileSystem,
  FileStat,
  FileTuple,
  FileType,
  path,
} from '@shopify/theme-check-common';

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
   * Invalidates the directories that change when uri is created.
   *
   * The parent directory gains an entry. Creating a file can also create
   * missing parent directories, so this walks up to the first directory that
   * the cache knows already existed.
   */
  invalidateDirectoriesForCreate(uri: string): void {
    this.invalidateDirectoriesAbove(uri, (dir) => this.existed(dir));
  }

  /**
   * Invalidates the directories that change when uri is deleted.
   *
   * The parent directory loses an entry. Deleting the last file in a directory
   * can remove it, so this walks up to the first directory that the cache
   * knows still has other entries.
   */
  invalidateDirectoriesForDelete(uri: string): void {
    this.invalidateDirectoriesAbove(uri, (dir, entry) => this.hasOtherEntries(dir, entry));
  }

  /**
   * Invalidates the directories that change when oldUri is renamed to newUri.
   *
   * Directories above newUri exist after the rename and directories above
   * oldUri existed before it, so a rename within one directory only changes
   * that directory's listing.
   */
  invalidateDirectoriesForRename(oldUri: string, newUri: string): void {
    const oldDirs = directoriesAbove(oldUri);
    const newDirs = directoriesAbove(newUri);
    this.invalidateDirectoriesAbove(
      oldUri,
      (dir, entry) => newDirs.includes(dir) || this.hasOtherEntries(dir, entry),
    );
    this.invalidateDirectoriesAbove(newUri, (dir) => oldDirs.includes(dir) || this.existed(dir));
  }

  /**
   * Invalidates the listing of each directory above uri, up to the first one
   * that exists both before and after the change.
   *
   * Each directory below that one appeared or disappeared, so its stat is
   * invalidated too.
   */
  private invalidateDirectoriesAbove(
    uri: string,
    existsBeforeAndAfter: (dir: string, entry: string) => boolean,
  ): void {
    let entry = path.normalize(uri);
    for (const dir of directoriesAbove(uri)) {
      // The check reads the cache, so it runs before the invalidation.
      const isLastChangedDirectory = existsBeforeAndAfter(dir, entry);
      this.readDirectory.invalidate(dir);
      if (isLastChangedDirectory) return;

      this.stat.invalidate(dir);
      entry = dir;
    }
  }

  /** Whether the cache shows that dir existed. */
  private existed(dir: string): boolean {
    if (this.stat.peek(dir)?.type === FileType.Directory) return true;

    const siblings = this.readDirectory.peek(path.dirname(dir)) ?? [];
    return siblings.some(
      ([uri, type]) => type === FileType.Directory && path.normalize(uri) === dir,
    );
  }

  /** Whether the cached listing of dir has an entry other than entry. */
  private hasOtherEntries(dir: string, entry: string): boolean {
    const entries = this.readDirectory.peek(dir) ?? [];
    return entries.some(([uri]) => path.normalize(uri) !== entry);
  }
}

interface Cached<T> {
  (uri: string): Promise<T>;
  invalidate(uri: string): void;
  /** Returns the cached value if it has resolved, without calling the file system. */
  peek(uri: string): T | undefined;
}

/**
 * Lists the directories above uri, nearest first, ending at the root.
 */
function directoriesAbove(uri: string): string[] {
  const dir = path.dirname(uri);
  // dirname returns the root unchanged. Requiring a shorter URI also
  // guarantees that the recursion ends.
  const uriIsAbsoluteRoot = dir.length >= uri.length;
  if (uriIsAbsoluteRoot) return [];

  return [dir, ...directoriesAbove(dir)];
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
