import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BaseLanguageClient } from 'vscode-languageclient';

const mocks = vi.hoisted(() => ({
  showInformationMessage: vi.fn(),
  showQuickPick: vi.fn(),
  showTextDocument: vi.fn(),
  openTextDocument: vi.fn(() => Promise.resolve({})),
  findFiles: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getWorkspaceFolder: vi.fn(),
  asRelativePath: vi.fn(),
}));

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: mocks.showInformationMessage,
    showQuickPick: mocks.showQuickPick,
    showTextDocument: mocks.showTextDocument,
  },
  workspace: {
    getConfiguration: () => ({ get: mocks.getConfig, update: mocks.updateConfig }),
    findFiles: mocks.findFiles,
    openTextDocument: mocks.openTextDocument,
    getWorkspaceFolder: mocks.getWorkspaceFolder,
    asRelativePath: mocks.asRelativePath,
  },
  commands: { executeCommand: vi.fn() },
  ConfigurationTarget: { Global: 1 },
  Uri: { parse: (s: string) => ({ toString: () => s }) },
  Position: class {
    constructor(
      public line: number,
      public character: number,
    ) {}
  },
  Range: class {
    constructor(
      public start: any,
      public end: any,
    ) {}
  },
}));

import { checkOrphanedFilesOnBoot } from './orphanedFilesOnBoot';

function uriLike(s: string) {
  return { toString: () => s } as any;
}

/**
 * Builds a client whose ThemeGraphRootRequest/ThemeGraphDeadCodeRequest pair
 * resolves per anchor uri. `byUri` maps an anchor uri to the root + dead code the
 * server would return for it. Matches fetchDeadCode's Promise.all (root, deadCode).
 */
function clientWith(
  byUri: Record<string, { rootUri: string; deadCode: string[] }>,
): BaseLanguageClient {
  return {
    sendRequest: vi.fn((type: any, params: { uri: string }) => {
      const hit = byUri[params.uri];
      // Disambiguate the two requests by the request type's `method` string.
      const method: string = type?.method ?? '';
      if (method.toLowerCase().includes('deadcode')) {
        return Promise.resolve(hit?.deadCode ?? []);
      }
      return Promise.resolve(hit?.rootUri ?? '');
    }),
  } as unknown as BaseLanguageClient;
}

function requestedMethods(client: BaseLanguageClient): string[] {
  return (client.sendRequest as any).mock.calls.map(([type]: any[]) => type.method);
}

describe('checkOrphanedFilesOnBoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfig.mockReset().mockReturnValue(true);
    mocks.getWorkspaceFolder.mockReset().mockReturnValue(undefined);
  });

  it('is off by default', async () => {
    mocks.getConfig.mockImplementation((_key: string, defaultValue: boolean) => defaultValue);
    const client = clientWith({});

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.findFiles).not.toHaveBeenCalled();
    expect(client.sendRequest).not.toHaveBeenCalled();
  });

  it('globs for every theme-root signal, not just .theme-check.yml', async () => {
    mocks.findFiles.mockResolvedValue([]);
    const client = clientWith({});

    await checkOrphanedFilesOnBoot(client);

    const globPattern = mocks.findFiles.mock.calls[0][0] as string;
    expect(globPattern).toContain('.theme-check.yml');
    expect(globPattern).toContain('shopify.extension.toml');
    expect(globPattern).toContain('snippets');
  });

  it('notifies the user when the theme has orphaned files', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    const client = clientWith({
      'file:///theme/.theme-check.yml': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(mocks.showInformationMessage.mock.calls[0][0]).toBe(
      'Found 1 orphaned file in theme "theme".',
    );
  });

  it('names a nested theme by its path in the workspace', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///work/themes/horizon/.theme-check.yml')]);
    mocks.getWorkspaceFolder.mockReturnValue({ uri: uriLike('file:///work') });
    mocks.asRelativePath.mockReturnValue('themes/horizon');
    mocks.showInformationMessage.mockResolvedValue('Review');
    mocks.showQuickPick.mockResolvedValue(undefined);
    const client = clientWith({
      'file:///work/themes/horizon/.theme-check.yml': {
        rootUri: 'file:///work/themes/horizon',
        deadCode: ['file:///work/themes/horizon/snippets/a.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage.mock.calls[0][0]).toBe(
      'Found 1 orphaned file in theme "themes/horizon".',
    );
    expect(mocks.showQuickPick.mock.calls[0][1]).toMatchObject({
      title: 'Orphaned files in themes/horizon',
    });
  });

  it('does not notify when there are no orphaned files', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    const client = clientWith({
      'file:///theme/.theme-check.yml': { rootUri: 'file:///theme', deadCode: [] },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the setting is disabled', async () => {
    mocks.getConfig.mockReturnValue(false);
    const client = clientWith({});

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.findFiles).not.toHaveBeenCalled();
    expect(client.sendRequest).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the theme graph is off because preloadOnBoot is false', async () => {
    mocks.getConfig.mockImplementation((key: string) => key !== 'themeCheck.preloadOnBoot');
    const client = clientWith({});

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.findFiles).not.toHaveBeenCalled();
    expect(client.sendRequest).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });

  it('looks up the root once per directory, not once per snippet', async () => {
    mocks.findFiles.mockResolvedValue([
      uriLike('file:///theme/snippets/a.liquid'),
      uriLike('file:///theme/snippets/b.liquid'),
      uriLike('file:///theme/snippets/c.liquid'),
    ]);
    const client = clientWith({
      'file:///theme/snippets/a.liquid': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/c.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(requestedMethods(client)).toEqual(['themeGraph/rootUri', 'themeGraph/deadCode']);
    expect(mocks.showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it('asks for dead code once per root', async () => {
    mocks.findFiles.mockResolvedValue([
      uriLike('file:///theme/.theme-check.yml'),
      uriLike('file:///theme/snippets/a.liquid'),
    ]);
    const client = clientWith({
      'file:///theme/.theme-check.yml': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
      'file:///theme/snippets/a.liquid': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(requestedMethods(client).filter((m) => m === 'themeGraph/deadCode')).toHaveLength(1);
  });

  it('disables the setting when the user picks "Don\'t show again"', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    mocks.showInformationMessage.mockResolvedValue("Don't show again");
    const client = clientWith({
      'file:///theme/.theme-check.yml': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.updateConfig).toHaveBeenCalledWith(
      'themeCheck.checkOrphanedFilesOnBoot',
      false,
      1, // ConfigurationTarget.Global
    );
  });

  it('opens the dead-code picker when the user picks "Review"', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    mocks.showInformationMessage.mockResolvedValue('Review');
    mocks.showQuickPick.mockResolvedValue(undefined);
    const client = clientWith({
      'file:///theme/.theme-check.yml': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showQuickPick).toHaveBeenCalledTimes(1);
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  it('deduplicates anchors that resolve to the same root', async () => {
    // A theme with both a .theme-check.yml and a snippets dir yields two anchors
    // that the server resolves to the same root — it should only prompt once.
    mocks.findFiles.mockResolvedValue([
      uriLike('file:///theme/.theme-check.yml'),
      uriLike('file:///theme/snippets/a.liquid'),
    ]);
    const client = clientWith({
      'file:///theme/.theme-check.yml': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
      'file:///theme/snippets/a.liquid': {
        rootUri: 'file:///theme',
        deadCode: ['file:///theme/snippets/unused.liquid'],
      },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage).toHaveBeenCalledTimes(1);
  });

  it('prompts per root in a multi-theme workspace, with each count matching its own picker', async () => {
    // Two separate themes, each with its own orphaned files. The aggregated-count
    // bug would say "Found 3 orphaned files" once and only open theme-a's subset.
    mocks.findFiles.mockResolvedValue([
      uriLike('file:///theme-a/.theme-check.yml'),
      uriLike('file:///theme-b/shopify.extension.toml'),
    ]);
    const client = clientWith({
      'file:///theme-a/.theme-check.yml': {
        rootUri: 'file:///theme-a',
        deadCode: ['file:///theme-a/snippets/a1.liquid'],
      },
      'file:///theme-b/shopify.extension.toml': {
        rootUri: 'file:///theme-b',
        deadCode: ['file:///theme-b/snippets/b1.liquid', 'file:///theme-b/snippets/b2.liquid'],
      },
    });
    // Pick "Review" on every notification.
    mocks.showInformationMessage.mockResolvedValue('Review');
    mocks.showQuickPick.mockResolvedValue(undefined);

    await checkOrphanedFilesOnBoot(client);

    // One notification per theme with orphans.
    expect(mocks.showInformationMessage).toHaveBeenCalledTimes(2);
    const messages = mocks.showInformationMessage.mock.calls.map((c) => c[0]);
    expect(messages).toEqual([
      'Found 1 orphaned file in theme "theme-a".',
      'Found 2 orphaned files in theme "theme-b".',
    ]);

    // Review opened a picker for each theme — the picker for theme-b must show
    // theme-b's two files, never theme-a's subset.
    expect(mocks.showQuickPick).toHaveBeenCalledTimes(2);
  });

  it('only prompts for roots that actually have orphaned files', async () => {
    mocks.findFiles.mockResolvedValue([
      uriLike('file:///theme-a/.theme-check.yml'),
      uriLike('file:///theme-b/.theme-check.yml'),
    ]);
    const client = clientWith({
      'file:///theme-a/.theme-check.yml': {
        rootUri: 'file:///theme-a',
        deadCode: ['file:///theme-a/snippets/a1.liquid'],
      },
      'file:///theme-b/.theme-check.yml': { rootUri: 'file:///theme-b', deadCode: [] },
    });

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(mocks.showInformationMessage.mock.calls[0][0]).toContain('1 orphaned file');
  });
});
