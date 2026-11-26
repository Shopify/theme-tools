import { describe, it, expect, vi, beforeEach } from 'vitest';
import { window } from 'vscode';
import type * as vscode from 'vscode';
import * as prettier from 'prettier';
import { vscodePrettierFormat, nodePrettierFormat } from './formatter';

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
  window: {
    showWarningMessage: vi.fn(),
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

    it('should format local files with config options', async () => {
      vi.mocked(prettier.getFileInfo).mockResolvedValue({
        ignored: false,
      } as prettier.FileInfoResult);
      vi.mocked(prettier.resolveConfig).mockResolvedValue({ liquidSingleQuote: false });

      await vscodePrettierFormat(localFile);

      expect(prettier.getFileInfo).toHaveBeenCalled();
      expect(prettier.resolveConfig).toHaveBeenCalled();
      expect(prettier.format).toHaveBeenCalledWith('<div>{{ product.title }}</div>', {
        liquidSingleQuote: false,
        parser: 'liquid-html',
        plugins: [expect.anything()],
      });
    });

    it('should not format ignored local files', async () => {
      vi.mocked(prettier.getFileInfo).mockResolvedValue({
        ignored: true,
      } as prettier.FileInfoResult);

      const result = await nodePrettierFormat(localFile);

      expect(prettier.getFileInfo).toHaveBeenCalled();
      expect(prettier.resolveConfig).not.toHaveBeenCalled();
      expect(prettier.format).not.toHaveBeenCalled();
      expect(result).toBe('<div>{{ product.title }}</div>');
    });

    it('should unwrap ESM Prettier config exports', async () => {
      vi.mocked(prettier.getFileInfo).mockResolvedValue({
        ignored: false,
      } as prettier.FileInfoResult);
      const esmConfig = { default: { liquidSingleQuote: false } } as unknown as prettier.Options;
      Object.defineProperty(esmConfig, '__esModule', { value: true });
      vi.mocked(prettier.resolveConfig).mockResolvedValue(esmConfig);

      await nodePrettierFormat(localFile);

      expect(prettier.format).toHaveBeenCalledWith('<div>{{ product.title }}</div>', {
        liquidSingleQuote: false,
        parser: 'liquid-html',
        plugins: [expect.anything()],
      });
      expect(window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('should fall back to default options when the Prettier config cannot be loaded', async () => {
      vi.mocked(prettier.getFileInfo).mockResolvedValue({
        ignored: false,
      } as prettier.FileInfoResult);
      vi.mocked(prettier.resolveConfig).mockRejectedValue(new Error('Unsupported ESM config'));
      vi.mocked(prettier.format).mockReturnValue('formatted');

      const result = await nodePrettierFormat(localFile);
      await nodePrettierFormat(localFile);

      expect(result).toBe('formatted');
      expect(prettier.format).toHaveBeenCalledWith('<div>{{ product.title }}</div>', {
        parser: 'liquid-html',
        plugins: [expect.anything()],
      });
      expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
    });
  });
});
