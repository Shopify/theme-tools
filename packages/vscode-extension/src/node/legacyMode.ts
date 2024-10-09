import * as child_process from 'child_process';
import { promisify } from 'util';
import { window } from 'vscode';
import { ServerOptions } from 'vscode-languageclient/node';
import { getConfig } from '../utils';

const exec = promisify(child_process.exec);

const isWin = process.platform === 'win32';

class CommandNotFoundError extends Error {}

export async function getLegacyModeServerOptions(): Promise<ServerOptions | undefined> {
  const themeCheckPath = getConfig('shopifyLiquid.languageServerPath') as string | undefined;
  const shopifyCLIPath = getConfig('shopifyLiquid.shopifyCLIPath') as string | undefined;

  try {
    const executable: ServerOptions | undefined =
      (themeCheckPath && (await themeCheckExecutable(themeCheckPath))) ||
      (shopifyCLIPath && (await shopifyCLIExecutable(shopifyCLIPath))) ||
      (await getThemeCheckExecutable()) ||
      (await getShopifyCLIExecutable());
    if (!executable) {
      throw new Error('No executable found');
    }
    return executable;
  } catch (e) {
    if (e instanceof CommandNotFoundError) {
      window.showErrorMessage(e.message);
    } else {
      if (isWin) {
        window.showWarningMessage(
          `The 'theme-check-language-server' executable was not found on your $PATH. Was it installed? The path can also be changed via the "shopifyLiquid.languageServerPath" setting.`,
        );
      } else {
        console.error(e);
        window.showWarningMessage(
          `The 'shopify' executable was not found on your $PATH. Was it installed? The path can also be changed via the "shopifyLiquid.shopifyCLIPath" setting.`,
        );
      }
    }
  }
}

async function getShopifyCLIExecutable(): Promise<ServerOptions | undefined> {
  try {
    const path = await which('shopify');
    return shopifyCLIExecutable(path);
  } catch (e) {
    return undefined;
  }
}

async function getThemeCheckExecutable(): Promise<ServerOptions | undefined> {
  try {
    const path = await which('theme-check-language-server');
    return themeCheckExecutable(path);
  } catch (e) {
    return undefined;
  }
}

async function shopifyCLIExecutable(command: string | boolean): Promise<ServerOptions | undefined> {
  if (isWin || typeof command !== 'string' || command === '') {
    return;
  }
  return {
    command,
    args: ['theme', 'language-server'],
  };
}

async function themeCheckExecutable(command: string | boolean): Promise<ServerOptions | undefined> {
  if (typeof command !== 'string' || command === '') {
    return undefined;
  }
  await commandExists(command);
  return {
    command,
  };
}

async function commandExists(command: string): Promise<void> {
  try {
    !isWin && (await exec(`[ -f "${command}" ]`));
  } catch (e) {
    throw new CommandNotFoundError(`${command} not found, are you sure this is the correct path?`);
  }
}

async function which(command: string) {
  if (isWin) {
    const { stdout } = await exec(`where.exe ${command}`);
    const executables = stdout
      .replace(/\r/g, '')
      .split('\n')
      .filter((exe) => exe.endsWith('bat'));
    return executables.length > 0 && executables[0];
  } else {
    const { stdout } = await exec(`which ${command}`);
    return stdout.split('\n')[0].replace('\r', '');
  }
}
