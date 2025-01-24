import { it, expect, describe, vi, afterEach, afterAll, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { hasShopifyThemeLoaded, isCursor } from './utils';

vi.mock('vscode', async () => {
  const commands = {
    executeCommand: vi.fn(),
  };
  const workspace = {
    workspaceFolders: [{ uri: { fsPath: '/mock/path' } }],
    fs: {
      stat: vi.fn(),
    },
  };
  const uri = {
    file: vi.fn((path) => path),
  };

  return {
    commands,
    workspace,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Uri: uri,
  };
});

describe('utils', async () => {
  afterEach(vi.clearAllMocks);
  afterAll(vi.unstubAllGlobals);

  describe('hasShopifyThemeLoaded', async () => {
    it('should return true when all required folders exist', async () => {
      vi.mocked(workspace.fs.stat).mockResolvedValue(true as any);

      const result = await hasShopifyThemeLoaded();

      expect(result).toBeTruthy();
      expect(workspace.fs.stat).toHaveBeenCalledWith('/mock/path/config');
      expect(workspace.fs.stat).toHaveBeenCalledWith('/mock/path/layout');
      expect(workspace.fs.stat).toHaveBeenCalledWith('/mock/path/sections');
      expect(workspace.fs.stat).toHaveBeenCalledWith('/mock/path/templates');
    });

    it('should return false when a required folder is missing', async () => {
      vi.mocked(workspace.fs.stat).mockRejectedValue(new Error('Not found'));

      const result = await hasShopifyThemeLoaded();

      expect(result).toBeFalsy();
    });

    it('should return false when workspace has no folders', async () => {
      vi.mocked(workspace).workspaceFolders = undefined;

      const result = await hasShopifyThemeLoaded();

      expect(result).toBeFalsy();
    });

    it('should return false when an error occurs', async () => {
      vi.mocked(workspace.fs.stat).mockRejectedValue(new Error('Unknown error'));

      const result = await hasShopifyThemeLoaded();

      expect(result).toBeFalsy();
    });
  });

  describe('isCursor', () => {
    let process: any;

    beforeEach(() => {
      process = {
        title: 'Cursor',
        versions: { electron: '1.0.0' },
        env: {},
      };
    });

    it('should return true when running in Cursor electron process', () => {
      const result = isCursor(process);
      expect(result).toBeTruthy();
    });

    it('should return true when Cursor environment variables are set', () => {
      process.env.CURSOR_CHANNEL = 'test';
      const result = isCursor(process);
      expect(result).toBeTruthy();
    });

    it('should return false when not in Cursor environment', () => {
      process.title = '';
      const result = isCursor(process);
      expect(result).toBeFalsy();
    });

    it('should return false when an error occurs', () => {
      const result = isCursor({
        ...process,
        get title() {
          throw new Error('Unknown error');
        },
      });
      expect(result).toBeFalsy();
    });
  });
});
