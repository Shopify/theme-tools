import { AbstractFileSystem, path } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { describe, expect, it, vi } from 'vitest';
import { DocumentManager } from '../documents';
import { mockConnection } from '../test/MockConnection';
import { ThemeGraphManager } from './ThemeGraphManager';

describe('Module: ThemeGraphManager', () => {
  it('rebuilds a graph that failed to build when a file changes', async () => {
    const rootUri = path.normalize('file:/');
    const mockFs = new MockFileSystem(
      {
        'assets/theme.js': '',
        'sections/main.liquid': "{% render 'card' %}",
        'snippets/card.liquid': '',
      },
      rootUri,
    );
    let broken = true;
    const fs: AbstractFileSystem = {
      stat: (uri) => mockFs.stat(uri),
      readFile: (uri) => mockFs.readFile(uri),
      readDirectory: (uri) =>
        broken ? Promise.reject(new Error('EIO')) : mockFs.readDirectory(uri),
    };
    const connection = mockConnection(rootUri);
    const manager = new ThemeGraphManager(
      connection,
      new DocumentManager(fs),
      fs,
      async () => rootUri,
    );
    const card = path.join(rootUri, 'snippets', 'card.liquid');

    await expect(manager.getReferences(card)).rejects.toThrow('EIO');

    broken = false;
    vi.useFakeTimers();
    manager.change(card);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(await manager.getReferences(card)).toHaveLength(1);
  });

  it('reports only orphaned theme files the graph can link to', async () => {
    const rootUri = path.normalize('file:/theme');
    const fs = new MockFileSystem(
      {
        'layout/theme.liquid': "{{ 'theme.css' | asset_url }}",
        'assets/theme.css.liquid': '',
        'assets/unused.js': '',
        'assets/unused.css.liquid': '',
        'assets/icon.svg.liquid': '',
        'assets/jsconfig.json': '{}',
        'assets/package.json': '{}',
        'assets-old/unused.js': '',
        'snippets/unused.liquid': '',
      },
      rootUri,
    );
    const manager = new ThemeGraphManager(
      mockConnection(rootUri),
      new DocumentManager(fs),
      fs,
      async () => rootUri,
    );

    expect(await manager.deadCode(rootUri)).toEqual(
      ['assets/unused.css.liquid', 'assets/unused.js', 'snippets/unused.liquid'].map((file) =>
        path.join(rootUri, file),
      ),
    );
  });
});
