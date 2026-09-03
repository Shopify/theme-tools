import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BaseLanguageClient } from 'vscode-languageclient';

const mocks = vi.hoisted(() => ({
  showInformationMessage: vi.fn(),
  showQuickPick: vi.fn(),
  showTextDocument: vi.fn(),
  openTextDocument: vi.fn(() => Promise.resolve({})),
  executeCommand: vi.fn(),
  activeTextEditor: {
    document: { uri: { toString: () => 'file:///theme/layout/theme.liquid' } },
  } as any,
}));

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return mocks.activeTextEditor;
    },
    showInformationMessage: mocks.showInformationMessage,
    showQuickPick: mocks.showQuickPick,
    showTextDocument: mocks.showTextDocument,
  },
  workspace: { openTextDocument: mocks.openTextDocument },
  commands: { executeCommand: mocks.executeCommand },
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

import { makeDeadCode } from './commands';

function makeClient(rootUri: string, deadCode: string[]): BaseLanguageClient {
  return {
    sendRequest: vi
      .fn()
      .mockResolvedValueOnce(rootUri) // ThemeGraphRootRequest
      .mockResolvedValueOnce(deadCode), // ThemeGraphDeadCodeRequest
  } as unknown as BaseLanguageClient;
}

describe('makeDeadCode (characterization — behavior must survive refactor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeTextEditor = {
      document: { uri: { toString: () => 'file:///theme/layout/theme.liquid' } },
    };
  });

  it('tells the user when there is no dead code', async () => {
    const client = makeClient('file:///theme', []);

    await makeDeadCode(client)();

    expect(mocks.showInformationMessage).toHaveBeenCalledWith('No dead code found.');
    expect(mocks.showQuickPick).not.toHaveBeenCalled();
  });

  it('offers a quick pick of the orphaned files when dead code is found', async () => {
    const client = makeClient('file:///theme', [
      'file:///theme/snippets/unused-a.liquid',
      'file:///theme/snippets/unused-b.liquid',
    ]);

    await makeDeadCode(client)();

    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
    expect(mocks.showQuickPick).toHaveBeenCalledTimes(1);
    const [items, options] = mocks.showQuickPick.mock.calls[0];
    expect(items).toHaveLength(2);
    expect(options).toMatchObject({ canPickMany: true });
  });

  it('does nothing when there is no active editor', async () => {
    mocks.activeTextEditor = undefined;
    const client = makeClient('file:///theme', ['file:///theme/snippets/unused.liquid']);

    await makeDeadCode(client)();

    expect(client.sendRequest).not.toHaveBeenCalled();
    expect(mocks.showInformationMessage).not.toHaveBeenCalled();
    expect(mocks.showQuickPick).not.toHaveBeenCalled();
  });
});
