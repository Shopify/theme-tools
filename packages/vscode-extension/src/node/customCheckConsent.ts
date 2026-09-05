import { createHash } from 'node:crypto';
import path from 'node:path';
import { CustomCheckPermissionRequest } from '@shopify/theme-language-server-common';
import { ExtensionContext, window, workspace } from 'vscode';

const RUN_ONCE = 'Run once';
const ALWAYS_ALLOW = 'Always allow for this workspace';
const KEEP_DISABLED = 'Keep disabled';
const TRUSTED_CUSTOM_CHECKS_KEY = 'themeCheck.trustedCustomChecks';

export function makeCustomCheckPermissionHandler(context: ExtensionContext) {
  const sessionDecisions = new Map<string, boolean>();
  const pendingDecisions = new Map<string, Promise<boolean>>();

  return async function requestCustomCheckPermission(
    params: CustomCheckPermissionRequest.Params,
  ): Promise<boolean> {
    if (!workspace.isTrusted) {
      return false;
    }

    const fingerprint = fingerprintRequest(params);
    const trusted = context.workspaceState.get<string[]>(TRUSTED_CUSTOM_CHECKS_KEY, []);
    if (trusted.includes(fingerprint)) {
      return true;
    }

    const sessionDecision = sessionDecisions.get(fingerprint);
    if (sessionDecision !== undefined) {
      return sessionDecision;
    }

    const pendingDecision = pendingDecisions.get(fingerprint);
    if (pendingDecision) {
      return pendingDecision;
    }

    const decision = promptForPermission(context, params, fingerprint).finally(() => {
      pendingDecisions.delete(fingerprint);
    });
    pendingDecisions.set(fingerprint, decision);
    const allowed = await decision;
    sessionDecisions.set(fingerprint, allowed);
    return allowed;
  };
}

async function promptForPermission(
  context: ExtensionContext,
  params: CustomCheckPermissionRequest.Params,
  fingerprint: string,
): Promise<boolean> {
  const choice = await window.showWarningMessage(
    'This theme wants to run custom Theme Check code.',
    {
      modal: true,
      detail: permissionDetail(params),
    },
    RUN_ONCE,
    ALWAYS_ALLOW,
    KEEP_DISABLED,
  );

  if (choice === ALWAYS_ALLOW) {
    const trusted = context.workspaceState.get<string[]>(TRUSTED_CUSTOM_CHECKS_KEY, []);
    await context.workspaceState.update(
      TRUSTED_CUSTOM_CHECKS_KEY,
      Array.from(new Set([...trusted, fingerprint])),
    );
    return true;
  }

  return choice === RUN_ONCE;
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
  ].join('\n');
}

function fingerprintRequest(params: CustomCheckPermissionRequest.Params): string {
  const candidates = params.candidates
    .map(({ source, path }) => `${source}:${path}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(`${params.root}\n${candidates}`).digest('hex');
}
