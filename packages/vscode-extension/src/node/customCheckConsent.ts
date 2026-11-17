import path from 'node:path';
import { CustomCheckPermissionRequest } from '@shopify/theme-language-server-common';
import { window, workspace } from 'vscode';

const ALLOW_SESSION = 'Allow for this session';
const KEEP_DISABLED = 'Keep disabled';

export function makeCustomCheckPermissionHandler() {
  // A new language-server client gets new decisions. Never persist code execution consent.
  const sessionDecisions = new Map<string, boolean>();
  const pendingDecisions = new Map<string, Promise<boolean>>();

  return async function requestCustomCheckPermission(
    params: CustomCheckPermissionRequest.Params,
  ): Promise<boolean> {
    if (!canPromptForCustomChecks()) {
      return false;
    }

    const key = permissionRequestKey(params);
    const sessionDecision = sessionDecisions.get(key);
    if (sessionDecision !== undefined) {
      return sessionDecision;
    }

    const pendingDecision = pendingDecisions.get(key);
    if (pendingDecision) {
      const allowed = await pendingDecision;
      return canPromptForCustomChecks() && allowed;
    }

    const decision = promptForPermission(params).finally(() => {
      pendingDecisions.delete(key);
    });
    pendingDecisions.set(key, decision);
    const allowed = await decision;
    sessionDecisions.set(key, allowed);
    return canPromptForCustomChecks() && allowed;
  };
}

export function watchCustomCheckConfiguration(onChange: () => void) {
  let setting = customCheckSetting();
  return workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration('themeCheck.customChecks')) {
      return;
    }
    const nextSetting = customCheckSetting();
    if (nextSetting === setting) {
      return;
    }
    setting = nextSetting;
    onChange();
  });
}

function customCheckSetting(): string {
  // Read only user configuration, even if a theme includes workspace settings.
  return (
    workspace.getConfiguration('themeCheck').inspect<string>('customChecks')?.globalValue ??
    'prompt'
  );
}

function canPromptForCustomChecks(): boolean {
  return workspace.isTrusted && customCheckSetting() === 'prompt';
}

async function promptForPermission(params: CustomCheckPermissionRequest.Params): Promise<boolean> {
  const choice = await window.showWarningMessage(
    'This theme wants to run custom Theme Check code.',
    {
      modal: true,
      detail: permissionDetail(params),
    },
    ALLOW_SESSION,
    KEEP_DISABLED,
  );

  // Trust and user settings can change while the permission dialog is open.
  return canPromptForCustomChecks() && choice === ALLOW_SESSION;
}

function permissionDetail(params: CustomCheckPermissionRequest.Params): string {
  const candidates = params.candidates.map((candidate) => {
    const relativePath = path.relative(params.root, candidate.path);
    const displayPath = relativePath.startsWith('..')
      ? candidate.path
      : `.${path.sep}${relativePath}`;
    return `• ${displayPath}`;
  });

  return [
    'Custom checks execute JavaScript with your user permissions:',
    '',
    ...candidates,
    '',
    'Only allow this if you trust the theme and these checks.',
    'Permission lasts until the language server restarts or the VS Code window reloads.',
    'Changes to these checks and their dependencies are also trusted during this session.',
  ].join('\n');
}

function permissionRequestKey(params: CustomCheckPermissionRequest.Params): string {
  const candidates = params.candidates.map(({ source, path }) => `${source}:${path}`).sort();
  return JSON.stringify({ root: params.root, candidates });
}
