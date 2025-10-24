import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as vscode from 'vscode';
import * as prettier from 'prettier';
import { vscodePrettierFormat, nodePrettierFormat } from '../../node/formatter';

vi.mock('prettier', () => ({
  format: vi.fn(),
  getFileInfo: vi.fn(),
  resolveConfig: vi.fn(),
}));

vi.mock('vscode', () => ({
  workspace: {
    getWorkspaceFolder: vi.fn(() => ({
      uri: { fsPath: '/workspace' },
    })),
  },
}));

describe('formatter', () => {
  const localFile = {
    uri: {
      scheme: 'file',
      fsPath: '/snippets/button.liquid',
    },
    getText: vi.fn(() => '<div>{{ product.title }}</div>'),
  } as unknown as vscode.TextDocument;

  const remoteFile = {
    ...localFile,
    uri: { ...localFile.uri, scheme: 'vscode-remote' },
  } as vscode.TextDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('vscodePrettierFormat', () => {
    it('should format remote files without config options', async () => {
      await vscodePrettierFormat(remoteFile);

      expect(prettier.getFileInfo).not.toHaveBeenCalled();
      expect(prettier.resolveConfig).not.toHaveBeenCalled();
      expect(prettier.format).toHaveBeenCalledWith('<div>{{ product.title }}</div>', {
        parser: 'liquid-html',
        plugins: [expect.anything()],
      });
    });
  });

  it('should format local files with config options', async () => {
    await vscodePrettierFormat(localFile);

    expect(prettier.getFileInfo).toHaveBeenCalled();
    expect(prettier.resolveConfig).toHaveBeenCalled();
    expect(prettier.format).toHaveBeenCalledWith('<div>{{ product.title }}</div>', {
      parser: 'liquid-html',
      plugins: [expect.anything()],
    });
  });

  it('should not format ignored local files', async () => {
    vi.mocked(prettier.getFileInfo).mockResolvedValue({ ignored: true } as prettier.FileInfoResult);

    const result = await nodePrettierFormat(localFile);

    expect(prettier.getFileInfo).toHaveBeenCalled();
    expect(prettier.resolveConfig).not.toHaveBeenCalled();
    expect(prettier.format).not.toHaveBeenCalled();
    expect(result).toBe('<div>{{ product.title }}</div>');
  });
});
