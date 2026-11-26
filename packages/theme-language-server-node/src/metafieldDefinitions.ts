import * as child_process from 'child_process';
import { promisify } from 'node:util';

const exec = promisify(child_process.exec);

const isWin = process.platform === 'win32';

const shopifyCliPathPromise = getShopifyCliPath();

export async function fetchMetafieldDefinitionsForURI(uri: string) {
  try {
    const path = await shopifyCliPathPromise;

    if (!path) {
      return;
    }

    await exec(`${path} theme metafields pull`, {
      cwd: new URL(uri),
      timeout: 10_000,
      env: {
        ...process.env,
        SHOPIFY_LANGUAGE_SERVER: '1',
        // Pull with an existing login. When there is none, the CLI fails
        // instead of opening a browser to log in. Shopify CLI checks
        // SHOPIFY_FLAG_NO_INPUT since 4.9 and CI since 3.77.
        SHOPIFY_FLAG_NO_INPUT: '1',
        CI: '1',
      },
    });
  } catch (_) {
    // The CLI fails when the user isn't logged in or has an old version.
    // Metafield completions then use whatever definitions are already on disk.
  }
}

async function getShopifyCliPath() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
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
  } catch (_) {
    // If any errors occur while trying to find the CLI, we will silently return
    return;
  }
}
