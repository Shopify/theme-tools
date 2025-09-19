import path from 'node:path';
import { workspace } from 'vscode';
import LiquidPrettierPlugin from '@shopify/prettier-plugin-liquid';
import * as prettier from 'prettier';
import { Format } from '../common/formatter';

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

  const options = await prettier.resolveConfig(textDocument.uri.fsPath, { useCache: false });
  return prettier.format(text, {
    ...options,
    parser: 'liquid-html',
    plugins: [LiquidPrettierPlugin as any],
  });
};
