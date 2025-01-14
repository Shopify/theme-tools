import * as child_process from 'child_process';
import { promisify } from 'node:util';

const exec = promisify(child_process.exec);

const isWin = process.platform === 'win32';

const shopifyCliPathPromise = getShopifyCliPath();

async function getShopifyCliPath() {
  if (isWin) {
    const { stdout } = await exec(`where.exe shopify`);
    const executables = stdout
      .replace(/\r/g, '')
      .split('\n')
      .filter((exe) => exe.endsWith('bat'));
    return executables.length > 0 ? executables[0] : '';
  } else {
    const { stdout } = await exec(`which shopify`);
    return stdout.split('\n')[0].replace('\r', '');
  }
}

export async function runCliCommand(command: string, uri?: string, timeout: number = 10_000) {
  const path = await shopifyCliPathPromise;

  if (!path) {
    throw Error('Shopify CLI not found');
  }

  return await exec(`${path} ${command}`, {
    cwd: uri ? new URL(uri) : undefined,
    timeout,
  });
}
