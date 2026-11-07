import path from 'node:path';
import { window, workspace } from 'vscode';
import LiquidPrettierPlugin from '@shopify/prettier-plugin-liquid';
import * as prettier from 'prettier';
import { Format } from '../common/formatter';

const warnedConfigFolders = new Set<string>();

export const vscodePrettierFormat: Format = async (textDocument) => {
  if (textDocument.uri.scheme === 'file') {
    return nodePrettierFormat(textDocument);
  }

  // When the files are remote, we can't resolve the prettier config.
  // Or tell if the file is ignored.
  const text = textDocument.getText();
  return prettier.format(text, {
    parser: 'liquid-html',
    plugins: [LiquidPrettierPlugin as any],
  });
};

export const nodePrettierFormat: Format = async (textDocument) => {
  const text = textDocument.getText();

  const workspaceFolder = workspace.getWorkspaceFolder(textDocument.uri);
  const fileInfo =
    workspaceFolder &&
    (await prettier.getFileInfo(textDocument.uri.fsPath, {
      ignorePath: path.join(workspaceFolder.uri.fsPath, '.prettierignore'),
    }));

  if (fileInfo?.ignored) {
    return text;
  }

  const warningScope = workspaceFolder?.uri.fsPath ?? path.dirname(textDocument.uri.fsPath);
  let options: prettier.Options | null;
  try {
    options = await prettier.resolveConfig(textDocument.uri.fsPath, { useCache: false });
    warnedConfigFolders.delete(warningScope);
  } catch (error) {
    console.error('Could not load the Prettier configuration; using default options.', error);
    options = null;

    if (!warnedConfigFolders.has(warningScope)) {
      warnedConfigFolders.add(warningScope);
      void window.showWarningMessage(
        'Could not load the Prettier configuration. Formatting with default options.',
      );
    }
  }

  options = unwrapPrettierConfig(options);
  return prettier.format(text, {
    ...options,
    parser: 'liquid-html',
    plugins: [LiquidPrettierPlugin as any],
  });
};

function unwrapPrettierConfig(options: prettier.Options | null): prettier.Options | null {
  const moduleConfig = options as (prettier.Options & Record<string, unknown>) | null;
  const defaultConfig = moduleConfig?.default;

  if (
    moduleConfig?.['__esModule'] === true &&
    defaultConfig !== null &&
    typeof defaultConfig === 'object'
  ) {
    return defaultConfig as prettier.Options;
  }

  return options;
}
