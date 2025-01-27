import { it, expect, describe, vi, afterEach, afterAll, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import { getShopifyThemeRootDirs, hasShopifyThemeLoaded, isCursor } from './utils';
import path from 'node:path';

vi.mock('vscode', async () => {
  return {
    commands: {
      executeCommand: vi.fn(),
    },
    workspace: {
      workspaceFolders: [],
      fs: {
        stat: vi.fn(),
      },
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Uri: {
      file: vi.fn((path) => path),
    },
  };
});

describe('utils', async () => {
  afterAll(vi.unstubAllGlobals);
  afterEach(vi.clearAllMocks);
  beforeEach(() => {
    vi.mocked(workspace).workspaceFolders = [
      { uri: { fsPath: '/mock/path1' } },
      { uri: { fsPath: '/mock/path2' } },
      { uri: { fsPath: '/mock/path3' } },
    ] as any;
  });

  describe('hasShopifyThemeLoaded', async () => {
    it('should return true when all required folders exist in one of the workspace folders', async () => {
      vi.mocked(workspace.fs.stat).mockResolvedValue(true as any);

      const rootPath = (folder: string) => {
        return path.join(path.sep, 'mock', 'path1', folder);
      };

      const result = await hasShopifyThemeLoaded();

      expect(result).toBeTruthy();
      expect(workspace.fs.stat).toHaveBeenCalledWith(rootPath('config'));
      expect(workspace.fs.stat).toHaveBeenCalledWith(rootPath('layout'));
      expect(workspace.fs.stat).toHaveBeenCalledWith(rootPath('sections'));
      expect(workspace.fs.stat).toHaveBeenCalledWith(rootPath('templates'));
    });

    it('should return false when a required folder is missing in one of the workspace folders', async () => {
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

  describe('getShopifyThemeRootDirs', async () => {
    it('should return paths when all required folders exist in one of the workspace folders', async () => {
      vi.mocked(workspace.fs.stat).mockImplementation((uri: any) => {
        if (uri.includes('path2')) {
          return Promise.resolve(true as any);
        } else {
          return Promise.reject(new Error('Not found'));
        }
      });

      const result = await getShopifyThemeRootDirs();

      expect(result).toEqual([path.join(path.sep, 'mock', 'path2')]);
    });

    it('should return empty array when required folders are missing', async () => {
      vi.mocked(workspace.fs.stat).mockRejectedValue(new Error('Not found'));

      const result = await getShopifyThemeRootDirs();

      expect(result).toEqual([]);
    });

    it('should return empty array when workspace has no folders', async () => {
      vi.mocked(workspace).workspaceFolders = undefined;

      const result = await getShopifyThemeRootDirs();

      expect(result).toEqual([]);
    });

    it('should return empty array when an error occurs', async () => {
      vi.mocked(workspace.fs.stat).mockRejectedValue(new Error('Unknown error'));

      const result = await getShopifyThemeRootDirs();

      expect(result).toEqual([]);
    });

    it('should handle multiple workspace folders', async () => {
      vi.mocked(workspace.fs.stat).mockImplementation((uri: any) => {
        if (uri.includes('path2')) {
          return Promise.reject(new Error('Not found'));
        } else {
          return Promise.resolve(true as any);
        }
      });

      const result = await getShopifyThemeRootDirs();

      expect(result).toEqual([
        path.join(path.sep, 'mock', 'path1'),
        path.join(path.sep, 'mock', 'path3'),
      ]);
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
