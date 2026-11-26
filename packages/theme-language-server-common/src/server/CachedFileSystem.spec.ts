import { FileType, path } from '@shopify/theme-check-common';
import { MockFileSystem, MockTheme } from '@shopify/theme-check-common/dist/test';
import { describe, expect, it, vi } from 'vitest';
import { CachedFileSystem } from './CachedFileSystem';

describe('CachedFileSystem', () => {
  const rootUri = path.normalize('browser:/theme');
  const sectionsUri = path.join(rootUri, 'sections');
  const snippetsUri = path.join(rootUri, 'snippets');
  const snippetUri = path.join(snippetsUri, 'card.liquid');
  const uri = (relativePath: string) => path.join(rootUri, relativePath);

  it('invalidates cached ancestor directories when a nested file is created', async () => {
    const fileTree: Record<string, string> = {};
    const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([]);
    await expect(fs.stat(snippetsUri)).rejects.toThrow();

    fileTree['snippets/card.liquid'] = '';
    fs.invalidateDirectoriesForCreate(snippetUri);

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[snippetsUri, FileType.Directory]]);
    await expect(fs.stat(snippetsUri)).resolves.toMatchObject({ type: FileType.Directory });
  });

  it('invalidates cached ancestor directories when the last nested file is deleted', async () => {
    const fileTree: Record<string, string> = { 'snippets/card.liquid': '' };
    const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[snippetsUri, FileType.Directory]]);
    await expect(fs.readDirectory(snippetsUri)).resolves.toEqual([[snippetUri, FileType.File]]);
    await expect(fs.stat(snippetsUri)).resolves.toMatchObject({ type: FileType.Directory });

    delete fileTree['snippets/card.liquid'];
    fs.invalidateDirectoriesForDelete(snippetUri);

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([]);
    await expect(fs.stat(snippetsUri)).rejects.toThrow();
  });

  it('invalidates cached ancestor directories when a file moves to a new directory', async () => {
    const fileTree: Record<string, string> = { 'sections/card.liquid': '' };
    const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[sectionsUri, FileType.Directory]]);
    await expect(fs.stat(snippetsUri)).rejects.toThrow();

    fileTree['snippets/card.liquid'] = fileTree['sections/card.liquid'];
    delete fileTree['sections/card.liquid'];
    fs.invalidateDirectoriesForRename(uri('sections/card.liquid'), snippetUri);

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[snippetsUri, FileType.Directory]]);
    await expect(fs.stat(snippetsUri)).resolves.toMatchObject({ type: FileType.Directory });
    await expect(fs.stat(sectionsUri)).rejects.toThrow();
  });

  it('keeps the cached root listing when a file is renamed within its directory', async () => {
    const fileTree: Record<string, string> = { 'sections/hero.liquid': '' };
    const mockFs = new MockFileSystem(fileTree, rootUri);
    const readDirectory = vi.spyOn(mockFs, 'readDirectory');
    const fs = new CachedFileSystem(mockFs);

    await fs.readDirectory(rootUri);
    await fs.readDirectory(sectionsUri);
    readDirectory.mockClear();

    fileTree['sections/banner.liquid'] = fileTree['sections/hero.liquid'];
    delete fileTree['sections/hero.liquid'];
    fs.invalidateDirectoriesForRename(uri('sections/hero.liquid'), uri('sections/banner.liquid'));

    await expect(fs.readDirectory(sectionsUri)).resolves.toEqual([
      [uri('sections/banner.liquid'), FileType.File],
    ]);
    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[sectionsUri, FileType.Directory]]);
    expect(readDirectory.mock.calls).toEqual([[sectionsUri]]);
  });

  it.each<Scenario>([
    {
      change: 'a rename within a directory',
      fileTree: { 'sections/a.liquid': '' },
      cache: [],
      invalidate: (fs) =>
        fs.invalidateDirectoriesForRename(uri('sections/a.liquid'), uri('sections/b.liquid')),
      readDirectory: [sectionsUri],
      stat: [],
    },
    {
      change: 'a create in a directory listed by its parent',
      fileTree: { 'sections/a.liquid': '' },
      cache: [['readDirectory', rootUri]],
      invalidate: (fs) => fs.invalidateDirectoriesForCreate(uri('sections/b.liquid')),
      readDirectory: [sectionsUri],
      stat: [],
    },
    {
      change: 'a create in a directory with a cached stat',
      fileTree: { 'sections/a.liquid': '' },
      cache: [['stat', sectionsUri]],
      invalidate: (fs) => fs.invalidateDirectoriesForCreate(uri('sections/b.liquid')),
      readDirectory: [sectionsUri],
      stat: [],
    },
    {
      change: 'a delete in a directory with other entries',
      fileTree: { 'sections/a.liquid': '', 'sections/b.liquid': '' },
      cache: [['readDirectory', sectionsUri]],
      invalidate: (fs) => fs.invalidateDirectoriesForDelete(uri('sections/a.liquid')),
      readDirectory: [sectionsUri],
      stat: [],
    },
    {
      change: 'a move between directories that keep existing',
      fileTree: { 'sections/a.liquid': '', 'sections/b.liquid': '', 'snippets/c.liquid': '' },
      cache: [
        ['readDirectory', rootUri],
        ['readDirectory', sectionsUri],
      ],
      invalidate: (fs) =>
        fs.invalidateDirectoriesForRename(uri('sections/a.liquid'), uri('snippets/a.liquid')),
      readDirectory: [sectionsUri, snippetsUri],
      stat: [],
    },
    {
      change: 'a create in a directory the cache knows nothing about',
      fileTree: { 'sections/a.liquid': '' },
      cache: [],
      invalidate: (fs) => fs.invalidateDirectoriesForCreate(uri('sections/b.liquid')),
      readDirectory: [sectionsUri, rootUri, 'browser:/'],
      stat: [sectionsUri, rootUri, 'browser:/'],
    },
    {
      change: 'a delete of the last cached entry',
      fileTree: { 'sections/a.liquid': '', 'snippets/c.liquid': '' },
      cache: [
        ['readDirectory', rootUri],
        ['readDirectory', sectionsUri],
      ],
      invalidate: (fs) => fs.invalidateDirectoriesForDelete(uri('sections/a.liquid')),
      readDirectory: [sectionsUri, rootUri],
      stat: [sectionsUri],
    },
  ])(
    'invalidates only the directories that change for $change',
    async ({ fileTree, cache, invalidate, readDirectory, stat }) => {
      const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));
      for (const [method, dir] of cache) await fs[method](dir);
      const invalidatedDirectories = vi.spyOn(fs.readDirectory, 'invalidate');
      const invalidatedStats = vi.spyOn(fs.stat, 'invalidate');

      invalidate(fs);

      expect(unique(invalidatedDirectories.mock.calls)).toEqual(readDirectory);
      expect(unique(invalidatedStats.mock.calls)).toEqual(stat);
    },
  );

  it('ignores a cached result that was invalidated while it was pending', async () => {
    const fileTree: Record<string, string> = { 'sections/a.liquid': '' };
    const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));

    const pending = fs.readDirectory(rootUri);
    fs.readDirectory.invalidate(rootUri);
    await pending;

    const invalidatedDirectories = vi.spyOn(fs.readDirectory, 'invalidate');
    fs.invalidateDirectoriesForCreate(uri('sections/b.liquid'));

    expect(invalidatedDirectories).toHaveBeenCalledWith(rootUri);
  });

  it.each([
    {
      uri: 'file:///c%3A/theme/snippets/card.liquid',
      dirs: ['file:///c:/theme/snippets', 'file:///c:/theme', 'file:///c:', 'file:///'],
    },
    {
      uri: 'file:///C:/theme/snippets/card.liquid',
      dirs: ['file:///c:/theme/snippets', 'file:///c:/theme', 'file:///c:', 'file:///'],
    },
    { uri: 'file:///c:', dirs: ['file:///'] },
    { uri: 'file:///C%3A', dirs: ['file:///'] },
    {
      uri: 'file://server/share/theme/card.liquid',
      dirs: ['file://server/share/theme', 'file://server/share', 'file://server/'],
    },
    {
      uri: 'file://wsl.localhost/Ubuntu/theme/card.liquid',
      dirs: [
        'file://wsl.localhost/Ubuntu/theme',
        'file://wsl.localhost/Ubuntu',
        'file://wsl.localhost/',
      ],
    },
    { uri: 'file:///', dirs: [] },
    {
      uri: 'browser:/theme/snippets/card.liquid',
      dirs: ['browser:/theme/snippets', 'browser:/theme', 'browser:/'],
    },
    { uri: 'untitled:Untitled-1', dirs: ['untitled:'] },
  ])(
    'invalidates every directory above $uri and stops at the root when nothing is cached',
    ({ uri, dirs }) => {
      for (const invalidate of [
        'invalidateDirectoriesForCreate',
        'invalidateDirectoriesForDelete',
      ] as const) {
        const fs = new CachedFileSystem(new MockFileSystem({}, rootUri));
        const readDirectory = vi.spyOn(fs.readDirectory, 'invalidate');
        const stat = vi.spyOn(fs.stat, 'invalidate');

        fs[invalidate](uri);

        expect(readDirectory.mock.calls.map(([dir]) => dir)).toEqual(dirs);
        expect(stat.mock.calls.map(([dir]) => dir)).toEqual(dirs);
      }
    },
  );
});

interface Scenario {
  change: string;
  fileTree: MockTheme;
  cache: ['readDirectory' | 'stat', string][];
  invalidate: (fs: CachedFileSystem) => void;
  readDirectory: string[];
  stat: string[];
}

function unique(calls: [string][]): string[] {
  return [...new Set(calls.map(([dir]) => dir))];
}
