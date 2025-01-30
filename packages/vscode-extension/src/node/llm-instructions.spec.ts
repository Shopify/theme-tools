import { it, expect, describe, vi, afterEach, afterAll, beforeEach } from 'vitest';
import {
  createInstructionsFiles,
  isInstructionsFileUpdated,
  templateContent,
} from './llm-instructions';
import { window, ExtensionContext } from 'vscode';
import { getShopifyThemeRootDirs, isCursor } from './utils';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileExists } from './fs';

vi.mock('./utils');
vi.mock('vscode', async () => {
  return {
    window: {
      showInformationMessage: vi.fn().mockResolvedValue('Yes'),
    },
    workspace: {
      fs: {
        writeFile: async (uri: { path: string }, content: Uint8Array) => {
          return fs.writeFile(uri.path, content);
        },
        createDirectory: async (uri: { path: string }) => {
          return fs.mkdir(uri.path, { recursive: true });
        },
        stat: async (uri: { path: string }) => {
          return fs.stat(uri.path);
        },
        readFile: async (uri: { path: string }) => {
          return fs.readFile(uri.path);
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Uri: {
      file: (path: string) => ({ path }),
    },
  };
});

describe('createInstructionsFiles', async () => {
  const nullLogger = () => {};
  const ctx = {
    globalState: {
      get: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as ExtensionContext;

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shopify-test-'));

    vi.mocked(getShopifyThemeRootDirs).mockResolvedValue([
      path.join(tmpDir, 'theme1'),
      path.join(tmpDir, 'theme2'),
    ]);

    const themeDirs = await getShopifyThemeRootDirs();
    await Promise.all(themeDirs.map((dir) => fs.mkdir(dir, { recursive: true })));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('createInstructionsFiles', async () => {
    it('should create Cursor instructions files for each theme directory when user accepts', async () => {
      vi.mocked(isCursor).mockReturnValue(true);

      await createInstructionsFiles(ctx, nullLogger);

      expect(window.showInformationMessage).toHaveBeenCalledTimes(2);

      for (const themeDir of await getShopifyThemeRootDirs()) {
        const rulesPath = path.join(themeDir, '.cursorrules');
        expect(await fileExists(rulesPath)).toBeTruthy();
      }
    });

    it('should not create files when user declines', async () => {
      vi.mocked(isCursor).mockReturnValue(true);
      vi.mocked(window.showInformationMessage).mockResolvedValue('No' as any);

      await createInstructionsFiles(ctx, nullLogger);

      expect(window.showInformationMessage).toHaveBeenCalledTimes(2);

      for (const themeDir of await getShopifyThemeRootDirs()) {
        const rulesPath = path.join(themeDir, '.cursorrules');
        expect(await fileExists(rulesPath)).toBeFalsy();
      }

      expect(ctx.globalState.update).toHaveBeenCalledTimes(2);
    });

    it('should create Copilot instructions when not using Cursor', async () => {
      vi.mocked(isCursor).mockReturnValue(false);
      vi.mocked(window.showInformationMessage).mockResolvedValue('Yes' as any);

      await createInstructionsFiles(ctx, nullLogger);

      for (const themeDir of await getShopifyThemeRootDirs()) {
        const copilotPath = path.join(themeDir, '.github', 'copilot-instructions.md');
        expect(await fileExists(copilotPath)).toBeTruthy();
      }
    });

    it('should prompt for update when file exists', async () => {
      vi.mocked(isCursor).mockReturnValue(true);
      vi.mocked(window.showInformationMessage).mockResolvedValue('Yes' as any);

      for (const themeDir of await getShopifyThemeRootDirs()) {
        const rulesPath = path.join(themeDir, '.cursorrules');
        await fs.mkdir(path.dirname(rulesPath), { recursive: true });
        await fs.writeFile(rulesPath, 'old content');
      }

      await createInstructionsFiles(ctx, nullLogger);

      expect(window.showInformationMessage).toHaveBeenCalledTimes(2);

      for (const themeDir of await getShopifyThemeRootDirs()) {
        const rulesPath = path.join(themeDir, '.cursorrules');
        const content = await fs.readFile(rulesPath, 'utf-8');
        expect(content).not.toBe('old content');
      }
    });
  });

  describe('isInstructionsFileUpdated', () => {
    let config: any;

    beforeEach(async () => {
      config = {
        path: path.join(tmpDir, '.cursorrules'),
        prompt: {
          create: 'create prompt',
          update: 'update prompt',
        },
      };
    });

    it('should return false when file does not contain liquid_development tags', async () => {
      await fs.writeFile(config.path, 'content without tags');
      const result = await isInstructionsFileUpdated(config, nullLogger);

      expect(result).toBeFalsy();
    });

    it('should return true when content similarity is >= 90%', async () => {
      const templateRules = await templateContent();
      const personalUserRules = Array.from({ length: 1000 }, () =>
        String.fromCharCode(Math.floor(Math.random() * (122 - 97 + 1)) + 97),
      ).join('');

      await fs.writeFile(config.path, personalUserRules + templateRules);

      const result = await isInstructionsFileUpdated(config, nullLogger);

      expect(result).toBeTruthy();
    });

    it('should return false when content similarity is < 90%', async () => {
      await fs.writeFile(
        config.path,
        '<liquid_development>completely different content</liquid_development>',
      );

      const result = await isInstructionsFileUpdated(config, nullLogger);
      expect(result).toBeFalsy();
    });

    it('should return true when there is an error reading the file', async () => {
      const configWithInvalidFile = {
        ...config,
        path: path.join(tmpDir, 'nonexistent-file'),
      };
      const result = await isInstructionsFileUpdated(configWithInvalidFile, nullLogger);

      expect(result).toBe(true);
    });
  });
});
