import { FileType, path, recursiveReadDirectory } from '@shopify/theme-check-common';
import { MockFileSystem, MockTheme } from '@shopify/theme-check-common/dist/test';
import { describe, expect, it, vi } from 'vitest';
import { CachedFileSystem } from './CachedFileSystem';

describe('CachedFileSystem', () => {
  const rootUri = path.normalize('browser:/theme');
  const uri = (relativePath: string) => path.join(rootUri, relativePath);

  it.each<Scenario>([
    {
      change: 'a file is renamed within its directory',
      files: { 'sections/hero.liquid': '' },
      changeFiles: (files) => move(files, 'sections/hero.liquid', 'sections/banner.liquid'),
      uris: ['sections/hero.liquid', 'sections/banner.liquid'],
      expected: ['sections/banner.liquid'],
    },
    {
      change: 'a file is created in an existing directory',
      files: { 'sections/a.liquid': '' },
      changeFiles: (files) => (files['sections/b.liquid'] = ''),
      uris: ['sections/b.liquid'],
      expected: ['sections/a.liquid', 'sections/b.liquid'],
    },
    {
      change: 'a file is deleted from a directory that keeps other files',
      files: { 'sections/a.liquid': '', 'sections/b.liquid': '' },
      changeFiles: (files) => delete files['sections/a.liquid'],
      uris: ['sections/a.liquid'],
      expected: ['sections/b.liquid'],
    },
    {
      change: 'a file moves between directories that keep existing',
      files: { 'sections/a.liquid': '', 'sections/b.liquid': '', 'snippets/c.liquid': '' },
      changeFiles: (files) => move(files, 'sections/a.liquid', 'snippets/a.liquid'),
      uris: ['sections/a.liquid', 'snippets/a.liquid'],
      expected: ['sections/b.liquid', 'snippets/a.liquid', 'snippets/c.liquid'],
    },
    {
      change: 'the last watched file of a nested directory is deleted with an unwatched sibling',
      files: {
        'snippets/keep.liquid': '',
        'snippets/nested/card.liquid': '',
        'snippets/nested/README.md': '',
      },
      changeFiles: (files) => {
        delete files['snippets/nested/card.liquid'];
        delete files['snippets/nested/README.md'];
      },
      uris: ['snippets/nested/card.liquid'],
      expected: ['snippets/keep.liquid'],
    },
  ])('keeps the cached theme root listing when $change', async (scenario) => {
    const { fs, readDirectory } = await run(scenario);

    expect(await listFiles(fs)).toEqual(scenario.expected);
    expect(readDirectory).not.toHaveBeenCalledWith(rootUri);
  });

  it.each<Scenario>([
    {
      change: 'the first file of a new directory is created',
      files: {},
      changeFiles: (files) => (files['snippets/card.liquid'] = ''),
      uris: ['snippets/card.liquid'],
      expected: ['snippets/card.liquid'],
    },
    {
      change: 'the first file of new nested directories is created',
      files: { 'sections/a.liquid': '' },
      changeFiles: (files) => (files['snippets/nested/card.liquid'] = ''),
      uris: ['snippets/nested/card.liquid'],
      expected: ['sections/a.liquid', 'snippets/nested/card.liquid'],
    },
    {
      change: 'the last file of a directory is deleted',
      files: { 'sections/a.liquid': '', 'snippets/card.liquid': '' },
      changeFiles: (files) => delete files['snippets/card.liquid'],
      uris: ['snippets/card.liquid'],
      expected: ['sections/a.liquid'],
    },
    {
      change: 'the last file of a directory moves to a new directory',
      files: { 'sections/card.liquid': '' },
      changeFiles: (files) => move(files, 'sections/card.liquid', 'snippets/card.liquid'),
      uris: ['sections/card.liquid', 'snippets/card.liquid'],
      expected: ['snippets/card.liquid'],
    },
    {
      change: 'a new directory is cached before the notification',
      files: {},
      changeFiles: (files) => (files['snippets/card.liquid'] = ''),
      afterChange: (fs) => fs.stat(uri('snippets')),
      uris: ['snippets/card.liquid'],
      expected: ['snippets/card.liquid'],
    },
    {
      change: 'a new nested directory is listed before the notification',
      files: {},
      changeFiles: (files) => (files['snippets/nested/card.liquid'] = ''),
      afterChange: (fs) => fs.readDirectory(uri('snippets')),
      uris: ['snippets/nested/card.liquid'],
      expected: ['snippets/nested/card.liquid'],
    },
    {
      change: 'a file moves to a new directory cached before the notification',
      files: { 'sections/a.liquid': '', 'sections/b.liquid': '' },
      changeFiles: (files) => move(files, 'sections/a.liquid', 'snippets/a.liquid'),
      afterChange: (fs) => fs.stat(uri('snippets')),
      uris: ['sections/a.liquid', 'snippets/a.liquid'],
      expected: ['sections/b.liquid', 'snippets/a.liquid'],
    },
  ])('refreshes the theme root listing when $change', async (scenario) => {
    const { fs, readDirectory } = await run(scenario);

    expect(await listFiles(fs)).toEqual(scenario.expected);
    expect(readDirectory).toHaveBeenCalledWith(rootUri);
  });

  it('refreshes a theme root listing still pending from before the change', async () => {
    const files: MockTheme = {};
    const { fs, readDirectory, mockFs } = setup(files);
    let respond!: () => void;
    const response = new Promise<void>((resolve) => (respond = resolve));
    readDirectory.mockImplementationOnce(async (uri) => {
      const listing = await mockFs.readDirectory(uri);
      await response;
      return listing;
    });

    const pending = fs.readDirectory(rootUri);
    files['snippets/card.liquid'] = '';
    await fs.invalidateDirectories([uri('snippets/card.liquid')]);
    respond();

    await expect(pending).resolves.toEqual([]);
    expect(await listFiles(fs)).toEqual(['snippets/card.liquid']);
  });

  it('refreshes a directory stat cached before the directory was created', async () => {
    const files: MockTheme = {};
    const { fs } = setup(files);

    await expect(fs.stat(uri('snippets'))).rejects.toThrow();
    files['snippets/card.liquid'] = '';
    await fs.readDirectory(rootUri);
    await fs.invalidateDirectories([uri('snippets/card.liquid')]);

    await expect(fs.stat(uri('snippets'))).resolves.toMatchObject({ type: FileType.Directory });
  });

  it('ignores a cached result that was invalidated while it was pending', async () => {
    const { fs } = setup({ 'sections/a.liquid': '' });

    const pending = fs.readDirectory(rootUri);
    fs.readDirectory.invalidate(rootUri);
    await pending;

    expect(fs.readDirectory.peek(rootUri)).toBeUndefined();
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
  ])('checks every directory above $uri and stops at the root', async ({ uri, dirs }) => {
    const { fs } = setup({});
    const readDirectory = vi.spyOn(fs.readDirectory, 'invalidate');
    const stat = vi.spyOn(fs.stat, 'invalidate');

    await fs.invalidateDirectories([uri]);

    // Nothing is cached, so every listing above uri is invalidated. The root
    // has no parent listing, so its stat isn't checked.
    expect(unique(readDirectory.mock.calls)).toEqual(dirs);
    expect(unique(stat.mock.calls)).toEqual(dirs.slice(0, -1));
  });

  interface Scenario {
    change: string;
    files: MockTheme;
    changeFiles: (files: MockTheme) => unknown;
    afterChange?: (fs: CachedFileSystem) => Promise<unknown>;
    /** Theme-relative paths of the changed files, as one notification. */
    uris: string[];
    /** Every file listed from the theme root afterwards. */
    expected: string[];
  }

  /**
   * Caches every listing, changes the files, then invalidates the changed
   * paths.
   */
  async function run(scenario: Scenario) {
    const files = { ...scenario.files };
    const { fs, readDirectory } = setup(files);
    await listFiles(fs);
    scenario.changeFiles(files);
    await scenario.afterChange?.(fs);
    readDirectory.mockClear();

    await fs.invalidateDirectories(scenario.uris.map(uri));

    return { fs, readDirectory };
  }

  function setup(files: MockTheme) {
    const mockFs = new MockFileSystem(files, rootUri);
    // Wrapped so that the directory reads MockFileSystem.stat makes aren't counted.
    const readDirectory = vi.fn((uri: string) => mockFs.readDirectory(uri));
    const fs = new CachedFileSystem({
      readFile: (uri) => mockFs.readFile(uri),
      readDirectory,
      stat: (uri) => mockFs.stat(uri),
    });
    return { fs, readDirectory, mockFs };
  }

  async function listFiles(fs: CachedFileSystem) {
    const uris = await recursiveReadDirectory(fs, rootUri, () => true);
    return uris.map((uri) => path.relative(uri, rootUri)).sort();
  }
});

function move(files: MockTheme, from: string, to: string) {
  files[to] = files[from];
  delete files[from];
}

function unique(calls: [string][]): string[] {
  return [...new Set(calls.map(([dir]) => dir))];
}
