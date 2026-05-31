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

/** sendRequest resolves root first, then dead code (matches fetchDeadCode's Promise.all order). */
function clientWith(rootUri: string, deadCode: string[]): BaseLanguageClient {
  return {
    sendRequest: vi.fn().mockResolvedValueOnce(rootUri).mockResolvedValueOnce(deadCode),
  } as unknown as BaseLanguageClient;
}

describe('checkOrphanedFilesOnBoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfig.mockReturnValue(true);
  });

  it('notifies the user when the theme has orphaned files', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    const client = clientWith('file:///theme', ['file:///theme/snippets/unused.liquid']);

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage).toHaveBeenCalledTimes(1);
    expect(mocks.showInformationMessage.mock.calls[0][0]).toContain('1 orphaned file');
  });

  it('does not notify when there are no orphaned files', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    const client = clientWith('file:///theme', []);

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does nothing when the setting is disabled', async () => {
    mocks.getConfig.mockReturnValue(false);
    const client = clientWith('file:///theme', ['file:///theme/snippets/unused.liquid']);

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.findFiles).not.toHaveBeenCalled();
    expect(client.sendRequest).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
  });

  it('disables the setting when the user picks "Don\'t show again"', async () => {
    mocks.findFiles.mockResolvedValue([uriLike('file:///theme/.theme-check.yml')]);
    mocks.showInformationMessage.mockResolvedValue("Don't show again");
    const client = clientWith('file:///theme', ['file:///theme/snippets/unused.liquid']);

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
    const client = clientWith('file:///theme', ['file:///theme/snippets/unused.liquid']);

    await checkOrphanedFilesOnBoot(client);

    expect(mocks.showQuickPick).toHaveBeenCalledTimes(1);
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
});
