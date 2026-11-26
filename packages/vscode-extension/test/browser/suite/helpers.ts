import * as vscode from 'vscode';

export const EXTENSION_ID = 'Shopify.theme-check-vscode';

/**
 * How long a test waits for the language server. The first requests after a
 * (re)start wait for the server to preload the whole theme.
 */
export const LANGUAGE_SERVER_TIMEOUT_MS = 30_000;

/** The URI of a file in the theme that the test workspace opens. */
export function themeUri(relativePath: string): vscode.Uri {
  const root = vscode.workspace.workspaceFolders![0].uri;
  return vscode.Uri.joinPath(root, ...relativePath.split('/'));
}

/**
 * Writes a file into the theme and opens it. The test workspace keeps writes in
 * memory, so fixtures never touch the theme on disk.
 */
export async function openFixture(relativePath: string, content: string) {
  const uri = await writeFixture(relativePath, content);
  return vscode.workspace.openTextDocument(uri);
}

export function openThemeFile(relativePath: string) {
  return vscode.workspace.openTextDocument(themeUri(relativePath));
}

export async function writeFixture(relativePath: string, content: string) {
  const uri = themeUri(relativePath);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  return uri;
}

/**
 * Calls `probe` until `accept` returns true for its result, and returns that
 * result. Fails with the last result when `timeoutMs` runs out.
 */
export async function waitFor<T>(
  description: string,
  probe: () => T | Thenable<T>,
  accept: (value: T) => boolean,
  timeoutMs = LANGUAGE_SERVER_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  let lastError: unknown;

  while (true) {
    try {
      last = await probe();
      if (accept(last)) return last;
    } catch (error) {
      lastError = error;
    }

    if (Date.now() > deadline) {
      const error = lastError === undefined ? '' : ` Last error: ${lastError}`;
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${description}. ` +
          `Last result: ${describe(last)}.${error}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Records the extension host's `console.error` calls until `restore` is called.
 * The extension logs the errors it swallows there, such as a formatter crash.
 *
 * VS Code forwards the extension host's console to the workbench through
 * accessors whose setter does nothing, so `console.error = ...` has no effect.
 * Replacing the global `console` does.
 */
export function captureConsoleErrors() {
  const scope = globalThis as { console: Console };
  const original = scope.console;
  const errors: string[] = [];
  scope.console = Object.create(original, {
    error: {
      value: (...values: unknown[]) => {
        errors.push(
          values.map((value) => (value instanceof Error ? value.stack : String(value))).join(' '),
        );
        original.error(...values);
      },
    },
  });
  return {
    errors,
    restore: () => {
      scope.console = original;
    },
  };
}

/** The theme-check diagnostics of a document, with the text that each one covers. */
export function themeCheckDiagnostics(document: vscode.TextDocument) {
  return vscode.languages
    .getDiagnostics(document.uri)
    .filter((diagnostic) => diagnostic.source === 'theme-check')
    .map((diagnostic) => ({
      code: diagnosticCode(diagnostic),
      severity: diagnostic.severity,
      message: diagnostic.message,
      text: document.getText(diagnostic.range),
    }));
}

export function waitForThemeCheckDiagnostics(
  document: vscode.TextDocument,
  accept: (diagnostics: ReturnType<typeof themeCheckDiagnostics>) => boolean,
) {
  return waitFor(
    `theme-check diagnostics in ${vscode.workspace.asRelativePath(document.uri)}`,
    () => themeCheckDiagnostics(document),
    accept,
  );
}

/** The plain text of a hover's contents. */
export function hoverText(hovers: vscode.Hover[] | undefined): string {
  return (hovers ?? [])
    .flatMap((hover) => hover.contents)
    .map((content) => (typeof content === 'string' ? content : content.value))
    .join('\n');
}

/** The position just after the first occurrence of `text` in the document. */
export function positionAfter(document: vscode.TextDocument, text: string): vscode.Position {
  const offset = document.getText().indexOf(text);
  if (offset === -1) throw new Error(`"${text}" is not in ${document.uri}`);
  return document.positionAt(offset + text.length);
}

/** A position inside the first occurrence of `text` in the document. */
export function positionIn(document: vscode.TextDocument, text: string): vscode.Position {
  const offset = document.getText().indexOf(text);
  if (offset === -1) throw new Error(`"${text}" is not in ${document.uri}`);
  return document.positionAt(offset + 1);
}

function diagnosticCode(diagnostic: vscode.Diagnostic) {
  const code = diagnostic.code;
  return typeof code === 'object' ? code.value : code;
}

function describe(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
