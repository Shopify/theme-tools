import { FileType, path } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/dist/test';
import { describe, expect, it } from 'vitest';
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
});
