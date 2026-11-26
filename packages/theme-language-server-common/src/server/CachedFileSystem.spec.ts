import { FileType, path } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/dist/test';
import { describe, expect, it, vi } from 'vitest';
import { CachedFileSystem } from './CachedFileSystem';

describe('CachedFileSystem', () => {
  const rootUri = path.normalize('browser:/theme');
  const snippetsUri = path.join(rootUri, 'snippets');
  const snippetUri = path.join(snippetsUri, 'card.liquid');

  it('invalidates cached ancestor directories when a nested file is created', async () => {
    const fileTree: Record<string, string> = {};
    const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([]);
    await expect(fs.stat(snippetsUri)).rejects.toThrow();

    fileTree['snippets/card.liquid'] = '';
    fs.invalidateDirectories(snippetUri);

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[snippetsUri, FileType.Directory]]);
    await expect(fs.stat(snippetsUri)).resolves.toMatchObject({ type: FileType.Directory });
  });

  it('invalidates cached ancestor directories when the last nested file is deleted', async () => {
    const fileTree: Record<string, string> = { 'snippets/card.liquid': '' };
    const fs = new CachedFileSystem(new MockFileSystem(fileTree, rootUri));

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([[snippetsUri, FileType.Directory]]);
    await expect(fs.stat(snippetsUri)).resolves.toMatchObject({ type: FileType.Directory });

    delete fileTree['snippets/card.liquid'];
    fs.invalidateDirectories(snippetUri);

    await expect(fs.readDirectory(rootUri)).resolves.toEqual([]);
    await expect(fs.stat(snippetsUri)).rejects.toThrow();
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
  ])('invalidates every directory above $uri and stops at the root', ({ uri, dirs }) => {
    const fs = new CachedFileSystem(new MockFileSystem({}, rootUri));
    const readDirectory = vi.spyOn(fs.readDirectory, 'invalidate');
    const stat = vi.spyOn(fs.stat, 'invalidate');

    fs.invalidateDirectories(uri);

    expect(readDirectory.mock.calls.map(([dir]) => dir)).toEqual(dirs);
    expect(stat.mock.calls.map(([dir]) => dir)).toEqual(dirs);
  });
});
