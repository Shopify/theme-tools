import * as child_process from 'child_process';
import { promisify } from 'node:util';

const exec = promisify(child_process.exec);

const isWin = process.platform === 'win32';

const shopifyCliPathPromise = getShopifyCliPath();

export async function fetchMetafieldDefinitionsForURI(uri: string) {
  const path = await shopifyCliPathPromise;

  if (!path) {
    return;
  }

  try {
    await exec(`${path} theme metafields pull`, {
      cwd: new URL(uri),
      timeout: 10_000,
    });
  } catch (_) {
    // CLI command can break because of incorrect version or not being logged in
    // If this fails, the user must fetch their own metafield definitions
  }
}

// eslint-disable-next-line no-unused-vars
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
