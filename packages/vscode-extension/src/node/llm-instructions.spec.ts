import { it, expect, describe, vi, afterEach, afterAll, beforeEach } from 'vitest';
import { createInstructionsFiles } from './llm-instructions';
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
  const templateFile = path.join(__dirname, '..', '..', 'resources', 'llm-instructions.template');
  const ctx = {
    globalState: {
      get: vi.fn(),
      update: vi.fn(),
    },
    asAbsolutePath: () => templateFile,
  } as unknown as ExtensionContext;

  let tmpDir: string;
  let themeDirs: string[];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shopify-test-'));
    themeDirs = [path.join(tmpDir, 'theme1'), path.join(tmpDir, 'theme2')];

    await Promise.all(themeDirs.map((dir) => fs.mkdir(dir, { recursive: true })));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should create Cursor instructions files for each theme directory when user accepts', async () => {
    vi.mocked(getShopifyThemeRootDirs).mockResolvedValue(themeDirs);
    vi.mocked(isCursor).mockReturnValue(true);

    await createInstructionsFiles(ctx, nullLogger);

    expect(window.showInformationMessage).toHaveBeenCalledTimes(2);

    for (const themeDir of themeDirs) {
      const rulesPath = path.join(themeDir, '.cursorrules');
      expect(await fileExists(rulesPath)).toBeTruthy();
    }
  });

  it('should not create files when user declines', async () => {
    vi.mocked(getShopifyThemeRootDirs).mockResolvedValue(themeDirs);
    vi.mocked(isCursor).mockReturnValue(true);
    vi.mocked(window.showInformationMessage).mockResolvedValue('No' as any);

    await createInstructionsFiles(ctx, nullLogger);

    expect(window.showInformationMessage).toHaveBeenCalledTimes(2);

    for (const themeDir of themeDirs) {
      const rulesPath = path.join(themeDir, '.cursorrules');
      expect(await fileExists(rulesPath)).toBeFalsy();
    }

    expect(ctx.globalState.update).toHaveBeenCalledTimes(2);
  });

  it('should create Copilot instructions when not using Cursor', async () => {
    vi.mocked(getShopifyThemeRootDirs).mockResolvedValue(themeDirs);
    vi.mocked(isCursor).mockReturnValue(false);
    vi.mocked(window.showInformationMessage).mockResolvedValue('Yes' as any);

    await createInstructionsFiles(ctx, nullLogger);

    for (const themeDir of themeDirs) {
      const copilotPath = path.join(themeDir, '.github', 'copilot-instructions.md');
      expect(await fileExists(copilotPath)).toBeTruthy();
    }
  });

  it('should prompt for update when file exists', async () => {
    vi.mocked(getShopifyThemeRootDirs).mockResolvedValue(themeDirs);
    vi.mocked(isCursor).mockReturnValue(true);
    vi.mocked(window.showInformationMessage).mockResolvedValue('Yes' as any);

    for (const themeDir of themeDirs) {
      const rulesPath = path.join(themeDir, '.cursorrules');
      await fs.mkdir(path.dirname(rulesPath), { recursive: true });
      await fs.writeFile(rulesPath, 'old content');
    }

    await createInstructionsFiles(ctx, nullLogger);

    expect(window.showInformationMessage).toHaveBeenCalledTimes(2);

    for (const themeDir of themeDirs) {
      const rulesPath = path.join(themeDir, '.cursorrules');
      const content = await fs.readFile(rulesPath, 'utf-8');
      expect(content).not.toBe('old content');
    }
  });
});
