import { beforeEach, describe, expect, it, vi } from 'vitest';
import { window, workspace } from 'vscode';
import { makeCustomCheckPermissionHandler } from './customCheckConsent';

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
  },
  workspace: {
    isTrusted: true,
  },
}));

describe('custom check consent', () => {
  const params = {
    root: '/themes/example',
    candidates: [{ source: 'require' as const, path: '/themes/example/checks/custom.js' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(workspace, 'isTrusted', { configurable: true, value: true });
  });

  it('denies custom checks without prompting in an untrusted workspace', async () => {
    Object.defineProperty(workspace, 'isTrusted', { configurable: true, value: false });
    const { context } = makeContext();

    const allowed = await makeCustomCheckPermissionHandler(context)(params);

    expect(allowed).toBe(false);
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('allows custom checks once after explicit consent', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Run once' as any);
    const { context } = makeContext();
    const handler = makeCustomCheckPermissionHandler(context);

    expect(await handler(params)).toBe(true);
    expect(await handler(params)).toBe(true);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps custom checks disabled when consent is declined', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Keep disabled' as any);
    const { context } = makeContext();
    const handler = makeCustomCheckPermissionHandler(context);

    expect(await handler(params)).toBe(false);
    expect(await handler(params)).toBe(false);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
  });

  it('persists workspace consent', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue(
      'Always allow for this workspace' as any,
    );
    const { context, update } = makeContext();

    expect(await makeCustomCheckPermissionHandler(context)(params)).toBe(true);
    vi.mocked(window.showWarningMessage).mockClear();
    expect(await makeCustomCheckPermissionHandler(context)(params)).toBe(true);

    expect(update).toHaveBeenCalledWith(
      'themeCheck.trustedCustomChecks',
      expect.arrayContaining([expect.any(String)]),
    );
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('prompts again when the requested custom checks change', async () => {
    vi.mocked(window.showWarningMessage).mockResolvedValue('Run once' as any);
    const { context } = makeContext();
    const handler = makeCustomCheckPermissionHandler(context);

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
});

function makeContext() {
  let state: string[] = [];
  const update = vi.fn(async (_key: string, value: string[]) => {
    state = value;
  });
  const context = {
    workspaceState: {
      get: vi.fn((_key: string, defaultValue: string[]) => state ?? defaultValue),
      update,
    },
  } as any;
  return { context, update };
}
