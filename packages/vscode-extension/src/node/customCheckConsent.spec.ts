import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '@shopify/theme-check-node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { window, workspace } from 'vscode';
import {
  makeCustomCheckPermissionHandler,
  watchCustomCheckConfiguration,
} from './customCheckConsent';

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
  },
  workspace: {
    isTrusted: true,
    getConfiguration: vi.fn(),
    onDidChangeConfiguration: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(workspace, 'isTrusted', { configurable: true, value: true });
  mockSetting();
});

describe('custom check consent', () => {
  const params = {
    root: '/themes/example',
    candidates: [{ source: 'require' as const, path: '/themes/example/checks/custom.js' }],
  };

  it('denies custom checks without prompting in an untrusted workspace', async () => {
    Object.defineProperty(workspace, 'isTrusted', { configurable: true, value: false });

    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('allows custom checks only for the session after explicit consent', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Allow for this session' as any);
    const handler = makeCustomCheckPermissionHandler();

    expect(await handler(params)).toBe(true);
    expect(await handler(params)).toBe(true);
    expect(window.showWarningMessage).toHaveBeenCalledExactlyOnceWith(
      'This theme wants to run custom Theme Check code.',
      {
        modal: true,
        detail: expect.stringContaining('Changes to these checks and their dependencies'),
      },
      'Allow for this session',
      'Keep disabled',
    );
  });

  it('keeps custom checks disabled when consent is declined', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Keep disabled' as any);
    const handler = makeCustomCheckPermissionHandler();

    expect(await handler(params)).toBe(false);
    expect(await handler(params)).toBe(false);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps custom checks disabled when the dialog is dismissed', async () => {
    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
  });

  it('requires a new decision for the same paths in a new language-server session', async () => {
    vi.mocked(window.showWarningMessage)
      .mockResolvedValueOnce('Allow for this session' as any)
      .mockResolvedValueOnce('Keep disabled' as any);

    expect(await makeCustomCheckPermissionHandler()(params)).toBe(true);
    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(2);
  });

  it('does not execute a replacement check at an approved path in a new session without consent', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-check-consent-'));
    const marker = path.join(root, 'executed');
    const modulePath = path.join(root, 'checks.cjs');
    const require = createRequire(import.meta.url);
    try {
      await fs.mkdir(path.join(root, '.git'));
      await fs.writeFile(path.join(root, '.theme-check.yml'), "require: './checks.cjs'\n");
      await fs.writeFile(
        modulePath,
        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'original'); exports.checks = [];`,
      );
      vi.mocked(window.showWarningMessage).mockResolvedValueOnce('Allow for this session' as any);
      await loadConfig(undefined, root, {
        authorizeCustomChecks: makeCustomCheckPermissionHandler(),
      });
      expect(await fs.readFile(marker, 'utf8')).toBe('original');
      await fs.rm(marker);
      await fs.writeFile(
        modulePath,
        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'replacement'); exports.checks = [];`,
      );
      // A new server process has no Node module cache from the previous session.
      delete require.cache[require.resolve(modulePath)];

      vi.mocked(window.showWarningMessage).mockResolvedValueOnce('Keep disabled' as any);
      await loadConfig(undefined, root, {
        authorizeCustomChecks: makeCustomCheckPermissionHandler(),
      });
      await expect(fs.stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(window.showWarningMessage).toHaveBeenCalledTimes(2);

      vi.mocked(window.showWarningMessage).mockResolvedValueOnce('Allow for this session' as any);
      await loadConfig(undefined, root, {
        authorizeCustomChecks: makeCustomCheckPermissionHandler(),
      });
      expect(await fs.readFile(marker, 'utf8')).toBe('replacement');
    } finally {
      delete require.cache[modulePath];
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('prompts again when the requested custom checks change', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Allow for this session' as any);
    const handler = makeCustomCheckPermissionHandler();

    await handler(params);
    await handler({
      ...params,
      candidates: [
        ...params.candidates,
        { source: 'require', path: '/themes/example/checks/new.js' },
      ],
    });

    expect(window.showWarningMessage).toHaveBeenCalledTimes(2);
  });

  it('denies permission if workspace trust changes while the dialog is open', async () => {
    vi.mocked(window.showWarningMessage).mockImplementation(async () => {
      Object.defineProperty(workspace, 'isTrusted', { configurable: true, value: false });
      return 'Allow for this session' as any;
    });

    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
  });

  it.each(['disabled', 'allow'])(
    'does not prompt or execute with user setting %s',
    async (setting) => {
      mockSetting({ globalValue: setting });

      expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
      expect(window.showWarningMessage).not.toHaveBeenCalled();
    },
  );

  it.each(['prompt', 'allow'])('ignores theme workspace setting %s', async (setting) => {
    mockSetting({ workspaceValue: setting, workspaceFolderValue: setting });
    vi.mocked(window.showWarningMessage).mockResolvedValue('Keep disabled' as any);

    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
    expect(window.showWarningMessage).toHaveBeenCalledOnce();
    expect(workspace.getConfiguration).toHaveBeenCalledWith('themeCheck');
  });

  it('does not let workspace settings override disabled user settings', async () => {
    mockSetting({
      globalValue: 'disabled',
      workspaceValue: 'prompt',
      workspaceFolderValue: 'prompt',
    });

    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('denies permission if custom checks are disabled while the dialog is open', async () => {
    vi.mocked(window.showWarningMessage).mockImplementation(async () => {
      mockSetting({ globalValue: 'disabled' });
      return 'Allow for this session' as any;
    });

    expect(await makeCustomCheckPermissionHandler()(params)).toBe(false);
  });

  it('does not reuse session approval while the user setting is disabled', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Allow for this session' as any);
    const handler = makeCustomCheckPermissionHandler();
    expect(await handler(params)).toBe(true);

    mockSetting({ globalValue: 'disabled' });
    expect(await handler(params)).toBe(false);
    expect(window.showWarningMessage).toHaveBeenCalledOnce();
  });

  it('does not confuse newlines in paths with separate modules', async () => {
    const handler = makeCustomCheckPermissionHandler();
    vi.mocked(window.showWarningMessage).mockResolvedValue('Allow for this session' as any);
    await handler({
      root: params.root,
      candidates: [
        { source: 'require', path: '/themes/example/a.js' },
        { source: 'require', path: '/themes/example/b.js' },
      ],
    });
    await handler({
      root: params.root,
      candidates: [
        { source: 'require', path: '/themes/example/a.js\nrequire:/themes/example/b.js' },
      ],
    });
    expect(window.showWarningMessage).toHaveBeenCalledTimes(2);
  });

  it('shares a pending permission request for concurrent config loads', async () => {
    const handler = makeCustomCheckPermissionHandler();
    let resolve!: (choice: any) => void;
    vi.mocked(window.showWarningMessage).mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );
    const first = handler(params);
    const second = handler(params);
    resolve('Allow for this session');
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(window.showWarningMessage).toHaveBeenCalledOnce();
  });
});

describe('custom check configuration changes', () => {
  it('restarts when the user setting changes in either direction', () => {
    const restart = vi.fn();
    const disposable = { dispose: vi.fn() };
    vi.mocked(workspace.onDidChangeConfiguration).mockReturnValue(disposable);
    const subscription = watchCustomCheckConfiguration(restart);
    const onChange = vi.mocked(workspace.onDidChangeConfiguration).mock.calls[0][0];
    const event = { affectsConfiguration: vi.fn(() => true) };

    mockSetting({ globalValue: 'disabled' });
    onChange(event);
    expect(restart).toHaveBeenCalledTimes(1);
    mockSetting({ globalValue: 'prompt' });
    onChange(event);
    expect(restart).toHaveBeenCalledTimes(2);
    expect(event.affectsConfiguration).toHaveBeenCalledWith('themeCheck.customChecks');
    expect(subscription).toBe(disposable);
  });

  it('does not restart for unrelated or workspace-only changes', () => {
    const restart = vi.fn();
    watchCustomCheckConfiguration(restart);
    const onChange = vi.mocked(workspace.onDidChangeConfiguration).mock.calls[0][0];

    mockSetting({ globalValue: 'disabled' });
    onChange({ affectsConfiguration: () => false });
    expect(restart).not.toHaveBeenCalled();
    mockSetting({ workspaceValue: 'disabled', workspaceFolderValue: 'disabled' });
    onChange({ affectsConfiguration: () => true });
    expect(restart).not.toHaveBeenCalled();
  });
});

function mockSetting(value?: {
  globalValue?: string;
  workspaceValue?: string;
  workspaceFolderValue?: string;
}) {
  vi.mocked(workspace.getConfiguration).mockReturnValue({
    inspect: vi.fn().mockReturnValue(value),
  } as any);
}
